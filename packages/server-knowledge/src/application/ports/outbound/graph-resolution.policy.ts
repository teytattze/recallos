import type { KnowledgeGraphId } from "../../../domain/knowledge-graph-id.value-object.ts";

/**
 * Resolves which graph an event belongs to from its routing `tags` (§11) — the
 * multi-tenancy seam the domain deferred. Phase 0 maps everything to a single
 * well-known graph; real isolation is a later policy swap behind this port.
 */
export interface GraphResolution {
  resolve(tags: Record<string, string>): KnowledgeGraphId;
}
