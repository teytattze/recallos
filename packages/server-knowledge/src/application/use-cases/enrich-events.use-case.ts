import { type Clock, type DomainEvent, Result } from "@repo/server-kernel";

import type { KnowledgeGraphEdge } from "../../domain/knowledge-graph-edge.aggregate.ts";
import type {
  EnrichEvents,
  EnrichEventsInput,
  EnrichmentReport,
} from "../ports/inbound/enrich-events.use-case.ts";
import type {
  Checkpoint,
  CheckpointStore,
} from "../ports/outbound/checkpoint.store.ts";
import type {
  EntityExtractorGateway,
  ExtractionResult,
} from "../ports/outbound/entity-extractor.gateway.ts";
import type { EventPublisher } from "../ports/outbound/event-publisher.port.ts";
import type { EventSourceReader } from "../ports/outbound/event-source.reader.ts";
import type { GraphResolution } from "../ports/outbound/graph-resolution.policy.ts";
import type { KnowledgeGraphEdgeRepository } from "../ports/outbound/knowledge-graph-edge.repository.ts";
import type { KnowledgeGraphNodeRepository } from "../ports/outbound/knowledge-graph-node.repository.ts";
import type { ProcessedEventLedger } from "../ports/outbound/processed-event.ledger.ts";
import type { UnitOfWork } from "../ports/outbound/unit-of-work.port.ts";

import {
  EntityResolution,
  type ResolutionMatch,
  type ResolutionThresholds,
} from "../../domain/entity-resolution.domain-service.ts";
import { GraphRelation } from "../../domain/graph-relation.domain-service.ts";
import { KnowledgeGraphNode } from "../../domain/knowledge-graph-node.aggregate.ts";

const CURSOR_NAME = "knowledge-enrichment";

/** Phase-0 thresholds. Only consulted once vector ANN matches are supplied;
 *  natural-key resolution short-circuits ahead of them (§8). */
const RESOLUTION_THRESHOLDS: ResolutionThresholds = {
  resolve: 0.9,
  ambiguous: 0.75,
};

/** Stable content hash of an extraction — the ledger's "same fact" guard (§9). */
function hashFact(result: ExtractionResult): string {
  const canonical = JSON.stringify({
    v: result.extractorVersion,
    nodes: result.nodes.map((n) => [n.type, n.naturalKey ?? "", n.body]),
    edges: result.edges.map((e) => [e.from, e.to, e.relationship]),
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export class EnrichEventsUseCase implements EnrichEvents {
  constructor(
    private readonly events: EventSourceReader,
    private readonly extractor: EntityExtractorGateway,
    private readonly nodes: KnowledgeGraphNodeRepository,
    private readonly edges: KnowledgeGraphEdgeRepository,
    private readonly graphResolution: GraphResolution,
    private readonly ledger: ProcessedEventLedger,
    private readonly checkpoints: CheckpointStore,
    private readonly publisher: EventPublisher,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: EnrichEventsInput): Promise<Result<EnrichmentReport>> {
    const cursor = await this.checkpoints.load(CURSOR_NAME);
    const page = await this.events.readSince(cursor, input.batchSize);

    if (page.length === 0) {
      return Result.ok({
        pulled: 0,
        processed: 0,
        skipped: 0,
        failed: 0,
        nodesUpserted: 0,
        edgesWritten: 0,
        cursor,
      });
    }

    // Pull/checkpoint by recordedAt (the page is ordered by it), but relate by
    // occurredAt so an edge's observedAt is correct under late arrivals (§10).
    const lastEntry = page[page.length - 1]!;
    const nextCursor: Checkpoint = {
      recordedAt: lastEntry.recordedAt,
      lastEventId: lastEntry.id,
    };
    const ordered = [...page].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );

    const nodeBuffer = new Map<string, KnowledgeGraphNode>();
    const edgeBuffer = new Map<string, KnowledgeGraphEdge>();
    // Intra-run caches so two entries in one page resolve to a single node/edge
    // before anything is persisted.
    const keyCache = new Map<string, KnowledgeGraphNode>();
    const edgeCache = new Map<string, KnowledgeGraphEdge>();
    const ledgerWrites: Array<{
      eventId: (typeof ordered)[number]["id"];
      version: string;
      status: "done" | "failed";
      factHash: string;
    }> = [];

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of ordered) {
      const graphId = this.graphResolution.resolve(entry.tags);

      let extraction: ExtractionResult;
      try {
        extraction = await this.extractor.extract(entry);
      } catch {
        // Poison event: park it as failed. The cursor still advances past it
        // (it won't be re-pulled), so one bad event never wedges the pipeline.
        failed++;
        ledgerWrites.push({
          eventId: entry.id,
          version: "unknown",
          status: "failed",
          factHash: "",
        });
        continue;
      }

      if (await this.ledger.seen(entry.id, extraction.extractorVersion)) {
        skipped++;
        continue;
      }

      const refToNode = new Map<string, KnowledgeGraphNode>();

      for (const candidate of extraction.nodes) {
        const cacheKey = candidate.naturalKey
          ? `${graphId.value}:${candidate.type}:${candidate.naturalKey}`
          : undefined;

        let node = cacheKey ? keyCache.get(cacheKey) : undefined;
        if (!node) {
          const matches: ResolutionMatch[] = [];
          let keyHit: KnowledgeGraphNode | null = null;
          if (candidate.naturalKey) {
            keyHit = await this.nodes.findByNaturalKey(
              graphId,
              candidate.type,
              candidate.naturalKey,
            );
            if (keyHit)
              matches.push({ nodeId: keyHit.id, score: 1, matchedByKey: true });
          }

          const decision = EntityResolution.classify(
            matches,
            RESOLUTION_THRESHOLDS,
          );
          if (decision.kind === "resolved" && keyHit) {
            node = keyHit;
          } else {
            // "new" and (Phase-0-unreachable) "ambiguous" both create a node;
            // the deferred-merge DUPLICATE_OF marker arrives with vector ANN.
            const created = KnowledgeGraphNode.create({
              graphId,
              type: candidate.type,
              body: candidate.body,
              eventIds: [entry.id],
              now: this.clock.now(),
            });
            if (!created.ok) continue;
            node = created.value;
          }
          if (cacheKey) keyCache.set(cacheKey, node);
        }

        node.attachEvents([entry.id], this.clock.now());
        nodeBuffer.set(node.id.value, node);
        refToNode.set(candidate.ref, node);
      }

      for (const candidate of extraction.edges) {
        const from = refToNode.get(candidate.from);
        const to = refToNode.get(candidate.to);
        if (!from || !to) continue;

        const tripleKey = `${graphId.value}:${from.id.value}:${to.id.value}:${candidate.relationship}`;
        let existing = edgeCache.get(tripleKey) ?? null;
        if (!existing)
          existing = await this.edges.findByTriple(
            graphId,
            from.id,
            to.id,
            candidate.relationship,
          );

        const related = GraphRelation.relate({
          from,
          to,
          relationship: candidate.relationship,
          confidence: candidate.confidence,
          sourceEventIds: [entry.id],
          observedAt: entry.occurredAt,
          existing,
          now: this.clock.now(),
        });
        if (!related.ok) continue;

        edgeCache.set(tripleKey, related.value);
        edgeBuffer.set(related.value.id.value, related.value);
      }

      processed++;
      ledgerWrites.push({
        eventId: entry.id,
        version: extraction.extractorVersion,
        status: "done",
        factHash: hashFact(extraction),
      });
    }

    const nodesToSave = [...nodeBuffer.values()];
    const edgesToSave = [...edgeBuffer.values()];

    await this.uow.run(async () => {
      await this.nodes.saveMany(nodesToSave);
      await this.edges.saveMany(edgesToSave);
      for (const write of ledgerWrites) {
        await this.ledger.record(
          write.eventId,
          write.version,
          write.status,
          write.factHash,
          1,
        );
      }
      await this.checkpoints.save(CURSOR_NAME, nextCursor);
    });

    const domainEvents: DomainEvent[] = [
      ...nodesToSave.flatMap((n) => [...n.pullDomainEvents()]),
      ...edgesToSave.flatMap((e) => [...e.pullDomainEvents()]),
    ];
    await this.publisher.publish(domainEvents);

    return Result.ok({
      pulled: page.length,
      processed,
      skipped,
      failed,
      nodesUpserted: nodesToSave.length,
      edgesWritten: edgesToSave.length,
      cursor: nextCursor,
    });
  }
}
