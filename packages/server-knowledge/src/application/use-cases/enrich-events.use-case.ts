import { type Clock, type DomainEvent, Result } from "@repo/server-kernel";

import type { KnowledgeGraphEdge } from "../../domain/knowledge-graph-edge.aggregate.ts";
import type {
  EnrichEvents,
  EnrichEventsInput,
  EnrichmentReport,
} from "../ports/inbound/enrich-events.use-case.ts";
import type {
  EntityExtractorGateway,
  ExtractionResult,
} from "../ports/outbound/entity-extractor.gateway.ts";
import type { EventPublisher } from "../ports/outbound/event-publisher.port.ts";
import type {
  EventEntry,
  EventSourceReader,
} from "../ports/outbound/event-source.reader.ts";
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
    private readonly source: EventSourceReader,
    private readonly extractor: EntityExtractorGateway,
    private readonly nodes: KnowledgeGraphNodeRepository,
    private readonly edges: KnowledgeGraphEdgeRepository,
    private readonly graphResolution: GraphResolution,
    private readonly ledger: ProcessedEventLedger,
    private readonly publisher: EventPublisher,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(input: EnrichEventsInput): Promise<Result<EnrichmentReport>> {
    if (input.events.length === 0) {
      return Result.ok({
        received: 0,
        processed: 0,
        skipped: 0,
        failed: 0,
        nodesUpserted: 0,
        edgesWritten: 0,
      });
    }

    // Re-read bodies from the source of truth; messages carry only ids/tags (§4).
    const bodies = await this.source.readBodies(
      input.events.map((event) => event.id),
    );

    // Relate in domain-time order so an edge's observedAt is correct and
    // reinforce keeps the latest observation under at-least-once delivery (§10).
    const ordered = [...input.events].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );

    const nodeBuffer = new Map<string, KnowledgeGraphNode>();
    const edgeBuffer = new Map<string, KnowledgeGraphEdge>();
    // Intra-run caches so two notifications in one batch resolve to a single
    // node/edge before anything is persisted.
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

    for (const notification of ordered) {
      const body = bodies.get(notification.id.value);
      if (!body) {
        // The outbox guarantees no phantom notifications, so a missing body is
        // a genuine fault — park it as failed rather than wedge the batch.
        failed++;
        ledgerWrites.push({
          eventId: notification.id,
          version: "unknown",
          status: "failed",
          factHash: "",
        });
        continue;
      }

      const entry: EventEntry = {
        id: notification.id,
        occurredAt: notification.occurredAt,
        tags: notification.tags,
        body,
      };
      const graphId = this.graphResolution.resolve(entry.tags);

      let extraction: ExtractionResult;
      try {
        extraction = await this.extractor.extract(entry);
      } catch {
        // Poison event: park it as failed so one bad event never wedges the
        // batch; the consumer's DLQ handles repeated failures.
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
    });

    const domainEvents: DomainEvent[] = [
      ...nodesToSave.flatMap((n) => [...n.pullDomainEvents()]),
      ...edgesToSave.flatMap((e) => [...e.pullDomainEvents()]),
    ];
    await this.publisher.publish(domainEvents);

    return Result.ok({
      received: input.events.length,
      processed,
      skipped,
      failed,
      nodesUpserted: nodesToSave.length,
      edgesWritten: edgesToSave.length,
    });
  }
}
