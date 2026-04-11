CREATE TABLE "codebase_chunks" (
	"id" uuid PRIMARY KEY,
	"content" text NOT NULL,
	"symbol_name" text NOT NULL,
	"symbol_kind" text NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"file_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codebase_files" (
	"id" uuid PRIMARY KEY,
	"file_path" text NOT NULL UNIQUE,
	"content" text NOT NULL,
	"content_hash_digest" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"indexed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "codebase_file_graph_edges" (
	"id" uuid PRIMARY KEY,
	"relationship" text NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codebase_chunks" ADD CONSTRAINT "codebase_chunks_file_id_codebase_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "codebase_files"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "codebase_file_graph_edges" ADD CONSTRAINT "codebase_file_graph_edges_from_id_codebase_files_id_fkey" FOREIGN KEY ("from_id") REFERENCES "codebase_files"("id");--> statement-breakpoint
ALTER TABLE "codebase_file_graph_edges" ADD CONSTRAINT "codebase_file_graph_edges_to_id_codebase_files_id_fkey" FOREIGN KEY ("to_id") REFERENCES "codebase_files"("id");