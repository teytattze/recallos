ALTER TABLE "codebase_files" RENAME COLUMN "content_digest" TO "content_hash_digest";--> statement-breakpoint
ALTER TABLE "graph_edges" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "graph_edges" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "graph_edges" ALTER COLUMN "id" DROP DEFAULT;