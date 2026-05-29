-- CreateEnum
CREATE TYPE "event_outbox_status" AS ENUM ('pending', 'sent');

-- CreateTable
CREATE TABLE "event_outbox" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "tags" JSONB NOT NULL,
    "status" "event_outbox_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_outbox_status_created_at_idx" ON "event_outbox"("status", "created_at");
