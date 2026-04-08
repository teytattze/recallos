ALTER TABLE "graph_edges" RENAME TO "codebase_chunk_graph_edges";--> statement-breakpoint
ALTER TABLE "codebase_chunk_graph_edges" DROP COLUMN "from_kind";--> statement-breakpoint
ALTER TABLE "codebase_chunk_graph_edges" DROP COLUMN "to_kind";--> statement-breakpoint
ALTER TABLE "codebase_chunk_graph_edges" ADD CONSTRAINT "codebase_chunk_graph_edges_from_id_codebase_chunks_id_fkey" FOREIGN KEY ("from_id") REFERENCES "codebase_chunks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "codebase_chunk_graph_edges" ADD CONSTRAINT "codebase_chunk_graph_edges_to_id_codebase_chunks_id_fkey" FOREIGN KEY ("to_id") REFERENCES "codebase_chunks"("id") ON DELETE CASCADE;