-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "tags" JSONB NOT NULL,
    "body" JSONB NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_recorded_at_idx" ON "events"("recorded_at");

-- CreateIndex
CREATE INDEX "events_tags_idx" ON "events" USING GIN ("tags" jsonb_ops);

