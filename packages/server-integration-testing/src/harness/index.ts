import { startMongodb, type StartedMongodb } from "./mongodb-container.ts";

/** Live connections every test drives — all backed by real containers, no fakes. */
export interface Harness {
  mongoClient: StartedMongodb["client"];
  databaseName: string;
  mongoUrl: string;
}

interface RunningHarness {
  harness: Harness;
  mongodb: StartedMongodb;
}

// Module-scoped singleton: the preload starts it once and every test file imports
// this same module instance to reach the shared connections.
let running: RunningHarness | undefined;

export function harness(): Harness {
  if (!running) {
    throw new Error(
      "integration harness not started — is src/setup.ts preloaded (bunfig.toml)?",
    );
  }
  return running.harness;
}

export async function startHarness(): Promise<void> {
  if (running) return;

  const mongodb = await startMongodb();

  running = {
    mongodb,
    harness: {
      mongoClient: mongodb.client,
      databaseName: mongodb.databaseName,
      mongoUrl: mongodb.url,
    },
  };
}

export async function stopHarness(): Promise<void> {
  if (!running) return;
  const { mongodb } = running;
  running = undefined;

  await mongodb.client.close();
  await mongodb.container.stop();
}
