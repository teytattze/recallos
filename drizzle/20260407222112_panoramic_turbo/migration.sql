CREATE TABLE "codebase_chunks" (
	"id" uuid PRIMARY KEY,
	"content" text NOT NULL,
	"symbol_name" text NOT NULL,
	"symbol_kind" text NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"embedding" vector(1024),
	"file_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codebase_files" (
	"id" uuid PRIMARY KEY,
	"file_path" text NOT NULL UNIQUE,
	"content" text NOT NULL,
	"content_digest" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"indexed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "graph_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"relationship" text NOT NULL,
	"from_id" uuid NOT NULL,
	"from_kind" text NOT NULL,
	"to_id" uuid NOT NULL,
	"to_kind" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codebase_chunks" ADD CONSTRAINT "codebase_chunks_file_id_codebase_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "codebase_files"("id") ON DELETE CASCADE;