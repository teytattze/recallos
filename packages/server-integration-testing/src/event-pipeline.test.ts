import { IngestEventUseCase } from "@repo/server-ingestion-core";
import { MongodbUnitOfWork } from "@repo/server-ingestion-outbound-adapter";
import { createFixedClock } from "@repo/server-kernel";
import type { Document } from "mongodb";
import { beforeEach, expect, test } from "bun:test";

import { harness } from "./harness/index.ts";

const createdAt = new Date("2026-05-30T12:00:00.000Z");
const tenant = "organization:org1";
const graphId = "01952d3f-0000-7000-8000-000000000100";
const external = { id: "jira-123", provider: "jira" } as const;
const raw = { issue: { key: "REC-123", summary: "hello" } };

const ingestInput = {
  tenant,
  payload: {
    external,
    graphId,
    raw,
  },
};

// Each test starts from an empty collection so assertions remain deterministic
// regardless of test order.
beforeEach(async () => {
  const { mongoClient, databaseName } = harness();
  await mongoClient.db(databaseName).collection("events").deleteMany({});
});

test("IngestEventUseCase over MongodbUnitOfWork: given a valid event, it should persist an event document", async () => {
  // GIVEN
  const { mongoClient, databaseName } = harness();
  const useCase = new IngestEventUseCase(
    createFixedClock(createdAt),
    new MongodbUnitOfWork(mongoClient, databaseName),
  );

  // WHEN
  const result = await useCase.execute(ingestInput);

  // THEN
  const event = await mongoClient
    .db(databaseName)
    .collection<Document>("events")
    .findOne({ _id: result.id });
  expect(event).toMatchObject({
    _id: result.id,
    createdAt,
    updatedAt: createdAt,
    tenant,
    external,
    graphId,
    raw,
  });

  expect(
    await mongoClient.db(databaseName).collection("events").countDocuments(),
  ).toBe(1);
});
