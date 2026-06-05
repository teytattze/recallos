-- Rename event capture timestamps to match EntityMetadata.createdAt.
ALTER TABLE "events" RENAME COLUMN "recorded_at" TO "created_at";
ALTER INDEX "events_recorded_at_idx" RENAME TO "events_created_at_idx";

-- `event_outbox.created_at` previously meant the outbox row enqueue time.
-- Move it aside so `created_at` can consistently mean the event's createdAt.
ALTER TABLE "event_outbox" RENAME COLUMN "created_at" TO "queued_at";
ALTER TABLE "event_outbox" RENAME COLUMN "recorded_at" TO "created_at";
ALTER INDEX "event_outbox_status_created_at_idx" RENAME TO "event_outbox_status_queued_at_idx";
