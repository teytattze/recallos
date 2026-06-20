import { MongoClient } from "mongodb";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { type APIRequestContext, test as base } from "playwright/test";
import { GenericContainer, type StartedTestContainer } from "testcontainers";

const MONGODB_IMAGE = "mongo:8";
const MONGODB_PORT = 27_017;
const REPLICA_SET_NAME = "rs0";
const DATABASE_NAME = "recallos-system-test";

const tenant = "organization:system-test";
const graphId = "01952d3f-0000-7000-8000-000000000100";
const subscriptionId = "01952d3f-0000-7000-8000-000000000101";
const webhookSecret = "system-test-webhook-secret";

type SystemHarness = {
  api: APIRequestContext;
  graphId: string;
  subscriptionId: string;
  tenant: string;
  webhookSecret: string;
};

type StringIdDocument = {
  _id: string;
  [key: string]: unknown;
};

type RunningProcess = {
  process: ChildProcess;
  output: () => string;
};

type StartedMongodb = {
  container: StartedTestContainer;
  url: string;
};

type EmbeddingServer = {
  server: Server;
  url: string;
};

const test = base.extend<{}, { system: SystemHarness }>({
  system: [
    async ({ playwright }, use) => {
      let mongodb: StartedMongodb | undefined;
      let mongoClient: MongoClient | undefined;
      let embeddingServer: EmbeddingServer | undefined;
      let apiProcess: RunningProcess | undefined;
      let workerProcess: RunningProcess | undefined;
      let api: APIRequestContext | undefined;
      let primaryError: unknown;
      let failed = false;

      try {
        mongodb = await startMongodb();
        mongoClient = new MongoClient(mongodb.url);
        await mongoClient.connect();
        embeddingServer = await startEmbeddingServer();
        await seedDatabase(mongoClient);

        const workerPort = await reservePort();
        const commonEnvironment = {
          ...process.env,
          APP_ENV: "local",
          INGESTION_MONGODB_URL: mongodb.url,
          INGESTION_MONGODB_DATABASE_NAME: DATABASE_NAME,
          KNOWLEDGE_MONGODB_URL: mongodb.url,
          KNOWLEDGE_MONGODB_DATABASE_NAME: DATABASE_NAME,
        };

        workerProcess = startApp("apps/server-worker", {
          ...commonEnvironment,
          HTTP_PORT: String(workerPort),
          KNOWLEDGE_VOYAGEAI_API_KEY: "system-test-api-key",
          KNOWLEDGE_VOYAGEAI_EMBEDDINGS_URL: `${embeddingServer.url}/v1/embeddings`,
        });
        await waitForHealth(workerPort, "/api/v1/ready", workerProcess);

        const apiPort = await reservePort();
        apiProcess = startApp("apps/server-api", {
          ...commonEnvironment,
          HTTP_PORT: String(apiPort),
        });
        await waitForHealth(apiPort, "/api/v1/health", apiProcess);

        api = await playwright.request.newContext({
          baseURL: `http://127.0.0.1:${apiPort}`,
        });

        await use({
          api,
          graphId,
          subscriptionId,
          tenant,
          webhookSecret,
        });
      } catch (error) {
        failed = true;
        primaryError = error;
      }

      const cleanupErrors = await cleanupResources({
        api,
        apiProcess,
        workerProcess,
        embeddingServer,
        mongoClient,
        mongodb,
      });

      if (failed && cleanupErrors.length > 0) {
        throw new AggregateError(
          [primaryError, ...cleanupErrors],
          "System test failed and resource cleanup also failed",
        );
      }
      if (failed) throw primaryError;
      if (cleanupErrors.length > 0) {
        throw new AggregateError(cleanupErrors, "Resource cleanup failed");
      }
    },
    { scope: "worker", timeout: 90_000 },
  ],
});

async function startMongodb(): Promise<StartedMongodb> {
  const container = await new GenericContainer(MONGODB_IMAGE)
    .withExposedPorts(MONGODB_PORT)
    .withCommand(["--replSet", REPLICA_SET_NAME, "--bind_ip_all"])
    .withStartupTimeout(60_000)
    .start();

  try {
    const initiateResult = await container.exec([
      "mongosh",
      "--quiet",
      "--eval",
      `rs.initiate({_id:'${REPLICA_SET_NAME}',members:[{_id:0,host:'localhost:${MONGODB_PORT}'}]}).ok`,
    ]);
    if (initiateResult.exitCode !== 0) {
      throw new Error(
        `Failed to initiate MongoDB replica set: ${initiateResult.output}`,
      );
    }

    await waitForMongoPrimary(container);

    return {
      container,
      url: `mongodb://${container.getHost()}:${container.getMappedPort(MONGODB_PORT)}/?directConnection=true&replicaSet=${REPLICA_SET_NAME}`,
    };
  } catch (error) {
    const cleanup = await Promise.allSettled([container.stop()]);
    const cleanupErrors = rejectedReasons(cleanup);
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "MongoDB startup and cleanup failed",
      );
    }
    throw error;
  }
}

async function waitForMongoPrimary(
  container: StartedTestContainer,
): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await container.exec([
      "mongosh",
      "--quiet",
      "--eval",
      "db.hello().isWritablePrimary",
    ]);
    if (result.exitCode === 0 && result.output.trim() === "true") return;
    await sleep(100);
  }
  throw new Error("MongoDB replica set did not elect a primary");
}

async function seedDatabase(client: MongoClient): Promise<void> {
  const database = client.db(DATABASE_NAME);
  const now = new Date("2026-06-20T00:00:00.000Z");

  await database.createCollection("events");
  await database.collection<StringIdDocument>("graphs").insertOne({
    _id: graphId,
    createdAt: now,
    updatedAt: now,
    tenant,
    embeddingMetadata: {
      dimension: "1024",
      model: "voyage-4-large",
    },
  });
  await database
    .collection<StringIdDocument>("webhook-subscriptions")
    .insertOne({
      _id: subscriptionId,
      createdAt: now,
      updatedAt: now,
      tenant,
      provider: "jira",
      context: {
        _id: "01952d3f-0000-7000-8000-000000000102",
        createdAt: now,
        updatedAt: now,
        graphId,
      },
      secret: {
        _id: "01952d3f-0000-7000-8000-000000000103",
        createdAt: now,
        updatedAt: now,
        algorithm: "hmac_sha256",
        value: webhookSecret,
      },
    });
}

async function startEmbeddingServer(): Promise<EmbeddingServer> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ data: [{ embedding: [0.25, 0.5], index: 0 }] }),
    );
  });
  try {
    await listen(server);
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Embedding server did not bind to a TCP port");
    }
    return { server, url: `http://127.0.0.1:${address.port}` };
  } catch (error) {
    if (!server.listening) throw error;
    const cleanup = await Promise.allSettled([stopServer(server)]);
    const cleanupErrors = rejectedReasons(cleanup);
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "Embedding server startup and cleanup failed",
      );
    }
    throw error;
  }
}

async function cleanupResources(input: {
  api: APIRequestContext | undefined;
  apiProcess: RunningProcess | undefined;
  workerProcess: RunningProcess | undefined;
  embeddingServer: EmbeddingServer | undefined;
  mongoClient: MongoClient | undefined;
  mongodb: StartedMongodb | undefined;
}): Promise<unknown[]> {
  const errors: unknown[] = [];

  errors.push(
    ...rejectedReasons(
      await settleCleanup([
        () => input.api?.dispose(),
        () => stopProcess(input.apiProcess),
        () => stopProcess(input.workerProcess),
      ]),
    ),
  );
  errors.push(
    ...rejectedReasons(
      await settleCleanup([
        () =>
          input.embeddingServer === undefined
            ? undefined
            : stopServer(input.embeddingServer.server),
        () => input.mongoClient?.close(),
      ]),
    ),
  );
  errors.push(
    ...rejectedReasons(
      await settleCleanup([() => input.mongodb?.container.stop()]),
    ),
  );

  return errors;
}

function settleCleanup(
  cleanups: (() => Promise<unknown> | undefined)[],
): Promise<PromiseSettledResult<unknown>[]> {
  return Promise.allSettled(
    cleanups.map((cleanup) => Promise.resolve().then(cleanup)),
  );
}

function rejectedReasons(results: PromiseSettledResult<unknown>[]): unknown[] {
  return results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
}

function startApp(
  workspace: "apps/server-api" | "apps/server-worker",
  environment: NodeJS.ProcessEnv,
): RunningProcess {
  const cwd = fileURLToPath(
    new URL(`../../../../${workspace}/`, import.meta.url),
  );
  const child = spawn("bun", ["run", "src/index.ts"], {
    cwd,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  return { process: child, output: () => output };
}

async function waitForHealth(
  port: number,
  path: "/api/v1/health" | "/api/v1/ready",
  runningProcess: RunningProcess,
): Promise<void> {
  const deadline = Date.now() + 20_000;
  const url = `http://127.0.0.1:${port}${path}`;

  while (Date.now() < deadline) {
    if (runningProcess.process.exitCode !== null) {
      throw new Error(
        `Application exited during startup:\n${runningProcess.output()}`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process has not started listening yet.
    }
    await sleep(100);
  }

  throw new Error(
    `Application did not become healthy at ${url}:\n${runningProcess.output()}`,
  );
}

async function reservePort(): Promise<number> {
  const server = createServer();
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Unable to reserve a TCP port");
  }
  const { port } = address;
  await stopServer(server);
  return port;
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

async function stopProcess(runningProcess: RunningProcess | undefined) {
  if (
    runningProcess === undefined ||
    runningProcess.process.exitCode !== null
  ) {
    return;
  }
  runningProcess.process.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => {
      runningProcess.process.once("exit", () => resolve());
    }),
    sleep(2_000).then(() => {
      runningProcess.process.kill("SIGKILL");
    }),
  ]);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export { test };
export type { SystemHarness };
