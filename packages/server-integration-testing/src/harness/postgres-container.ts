import { join } from "node:path";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";

const POSTGRES_IMAGE = "pgvector/pgvector:pg17";
const POSTGRES_PORT = 5432;
const POSTGRES_USER = "recallos";
const POSTGRES_PASSWORD = "recallos";
const POSTGRES_DB = "recallos";

// The migration history + prisma.config.ts (which reads DATABASE_URL) live in the
// server-database workspace; deploy runs against the freshly-started container.
const DATABASE_PACKAGE_DIR = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "server-database",
);

export interface StartedPostgres {
  container: StartedTestContainer;
  databaseUrl: string;
}

/**
 * Boots the real pgvector Postgres image and applies the actual Prisma migration
 * history — no schema is hand-rolled, so the test cluster matches production DDL
 * (extensions, enums, indexes) exactly.
 */
export async function startPostgres(): Promise<StartedPostgres> {
  const container = await new GenericContainer(POSTGRES_IMAGE)
    .withExposedPorts(POSTGRES_PORT)
    .withEnvironment({
      POSTGRES_USER,
      POSTGRES_PASSWORD,
      POSTGRES_DB,
    })
    // The image logs the readiness line twice (init, then serving); wait for the
    // second so we connect only once it is actually accepting client traffic.
    .withWaitStrategy(
      Wait.forLogMessage(/database system is ready to accept connections/, 2),
    )
    .start();

  const databaseUrl = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(POSTGRES_PORT)}/${POSTGRES_DB}`;

  await deployMigrations(databaseUrl);

  return { container, databaseUrl };
}

async function deployMigrations(databaseUrl: string): Promise<void> {
  const proc = Bun.spawn(["bun", "run", "db:migrate:deploy"], {
    cwd: DATABASE_PACKAGE_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    throw new Error(
      `prisma migrate deploy failed (exit ${exitCode}):\n${stdout}\n${stderr}`,
    );
  }
}
