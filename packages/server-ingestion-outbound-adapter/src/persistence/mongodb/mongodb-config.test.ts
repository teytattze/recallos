import { expect, test } from "bun:test";

import { getMongodbConfig } from "./mongodb-config";

test("getMongodbConfig: given MongoDB env, it should return the ingestion database config", () => {
  // GIVEN
  const previousUrl = process.env.INGESTION_MONGODB_URL;
  const previousDatabaseName = process.env.INGESTION_MONGODB_DATABASE_NAME;
  process.env.INGESTION_MONGODB_URL = "mongodb://localhost:27017";
  process.env.INGESTION_MONGODB_DATABASE_NAME = "recallos-test";

  try {
    // WHEN
    const config = getMongodbConfig();

    // THEN
    expect(config).toEqual({
      INGESTION_MONGODB_URL: "mongodb://localhost:27017",
      INGESTION_MONGODB_DATABASE_NAME: "recallos-test",
    });
  } finally {
    if (previousUrl === undefined) {
      delete process.env.INGESTION_MONGODB_URL;
    } else {
      process.env.INGESTION_MONGODB_URL = previousUrl;
    }

    if (previousDatabaseName === undefined) {
      delete process.env.INGESTION_MONGODB_DATABASE_NAME;
    } else {
      process.env.INGESTION_MONGODB_DATABASE_NAME = previousDatabaseName;
    }
  }
});
