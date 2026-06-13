import { createMongodbClient } from "@repo/server-database";
import { GenericContainer, type StartedTestContainer } from "testcontainers";

const MONGODB_IMAGE = "mongo:8";
const MONGODB_PORT = 27017;
const REPLICA_SET_NAME = "rs0";
const MONGODB_DATABASE_NAME = "recallos";

export interface StartedMongodb {
  client: ReturnType<typeof createMongodbClient>;
  container: StartedTestContainer;
  databaseName: string;
  url: string;
}

/**
 * Boots MongoDB as a single-node replica set because the production unit of
 * work uses MongoDB transactions.
 */
export async function startMongodb(): Promise<StartedMongodb> {
  const container = await new GenericContainer(MONGODB_IMAGE)
    .withExposedPorts(MONGODB_PORT)
    .withCommand(["--replSet", REPLICA_SET_NAME, "--bind_ip_all"])
    .start();

  const url = `mongodb://${container.getHost()}:${container.getMappedPort(MONGODB_PORT)}/?directConnection=true&replicaSet=${REPLICA_SET_NAME}`;
  const client = createMongodbClient({ url });
  await client.connect();
  await initiateReplicaSet(client);

  return {
    client,
    container,
    databaseName: MONGODB_DATABASE_NAME,
    url,
  };
}

async function initiateReplicaSet(
  client: ReturnType<typeof createMongodbClient>,
): Promise<void> {
  try {
    await client.db("admin").command({
      replSetInitiate: {
        _id: REPLICA_SET_NAME,
        members: [{ _id: 0, host: `localhost:${MONGODB_PORT}` }],
      },
    });
  } catch (error) {
    if (!isAlreadyInitialized(error)) throw error;
  }

  await waitForPrimary(client);
}

async function waitForPrimary(
  client: ReturnType<typeof createMongodbClient>,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await client.db("admin").command({ hello: 1 });
    if (result.isWritablePrimary === true) return;
    await Bun.sleep(100);
  }
  throw new Error("MongoDB replica set did not elect a primary");
}

function isAlreadyInitialized(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "codeName" in error &&
    error.codeName === "AlreadyInitialized"
  );
}
