import type { KnowledgeGraphId } from "../../../domain/knowledge-graph-id.value-object.ts";
import type { KnowledgeGraph } from "../../../domain/knowledge-graph.aggregate.ts";

/** Loads the graph root, whose policy (`embeddingModel`/`dimensions`) governs
 *  which embedding model `EmbedNodes` must use (§12). */
export interface KnowledgeGraphRepository {
  findById(id: KnowledgeGraphId): Promise<KnowledgeGraph | null>;
}
