import type { PrismaClient } from "@repo/server-database";

import type { OutboxBroker } from "./outbox-broker.ts";

interface PendingOutboxRow {
  id: string;
  event_id: string;
  occurred_at: Date;
  recorded_at: Date;
  tags: Record<string, string>;
}

/** Drains pending `event_outbox` rows to the broker. Claim, publish and mark-sent
 *  run in one transaction: `FOR UPDATE SKIP LOCKED` lets parallel relays take
 *  disjoint batches, and the row stays `pending` (re-published, then deduped by
 *  the Worker) if the process dies before commit — at-least-once, never lost. */
export class OutboxRelay {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly broker: OutboxBroker,
    private readonly batchSize: number,
  ) {}

  relayBatch(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PendingOutboxRow[]>`
        SELECT id, event_id, occurred_at, recorded_at, tags
        FROM event_outbox
        WHERE status = 'pending'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${this.batchSize}
      `;

      for (const row of rows) {
        await this.broker.publish({
          eventId: row.event_id,
          occurredAt: row.occurred_at,
          recordedAt: row.recorded_at,
          tags: row.tags,
        });
      }

      if (rows.length > 0) {
        await tx.eventOutbox.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: { status: "sent", sentAt: new Date() },
        });
      }

      return rows.length;
    });
  }
}
