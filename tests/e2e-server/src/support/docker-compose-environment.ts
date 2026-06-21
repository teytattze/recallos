import { invariant } from "es-toolkit";
import { fileURLToPath } from "node:url";
import {
  DockerComposeEnvironment as TestcontainersDockerComposeEnvironment,
  type StartedDockerComposeEnvironment,
  Wait,
} from "testcontainers";

import type { E2eResource } from "./e2e-resource.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const COMPOSE_FILES = ["compose.yml", "compose.apps.yml"];
const MONGO_CONTAINER_NAME = "mongo-1";
const MONGO_CONTAINER_PORT = 27017;
const MONGO_REPLICA_SET_NAME = "rs0";
const SERVER_API_CONTAINER_NAME = "server-api-1";
const SERVER_API_CONTAINER_PORT = 8000;
const SERVER_WORKER_CONTAINER_NAME = "server-worker-1";
const SERVER_WORKER_CONTAINER_PORT = 8001;
const ERROR_MESSAGE_UNDEFINED_CONTAINERS =
  "The Docker containers are undefined. Please ensure they are initialized properly";

class DockerComposeEnvironment implements E2eResource {
  #environment: StartedDockerComposeEnvironment | undefined;

  async init() {
    this.#environment = await new TestcontainersDockerComposeEnvironment(
      REPOSITORY_ROOT,
      COMPOSE_FILES,
    )
      .withBuild()
      .withWaitStrategy(MONGO_CONTAINER_NAME, Wait.forHealthCheck())
      .withWaitStrategy("mock-1", Wait.forHealthCheck())
      .withWaitStrategy(
        SERVER_API_CONTAINER_NAME,
        Wait.forHttp("/api/v1/health", SERVER_API_CONTAINER_PORT),
      )
      .withWaitStrategy(
        SERVER_WORKER_CONTAINER_NAME,
        Wait.forHttp("/api/v1/ready", SERVER_WORKER_CONTAINER_PORT),
      )
      .withStartupTimeout(60_000)
      .up(["mongo", "mock", "server-api", "server-worker"]);
  }

  async cleanUp() {
    await this.#environment?.down();
    this.#environment = undefined;
  }

  get mongodbUrl() {
    const mongoContainer =
      this.#environment?.getContainer(MONGO_CONTAINER_NAME);
    invariant(mongoContainer !== undefined, ERROR_MESSAGE_UNDEFINED_CONTAINERS);

    return `mongodb://${mongoContainer.getHost()}:${mongoContainer.getMappedPort(MONGO_CONTAINER_PORT)}/?directConnection=true&replicaSet=${MONGO_REPLICA_SET_NAME}`;
  }

  get serverApiUrl() {
    const serverApiContainer = this.#environment?.getContainer(
      SERVER_API_CONTAINER_NAME,
    );
    invariant(
      serverApiContainer !== undefined,
      ERROR_MESSAGE_UNDEFINED_CONTAINERS,
    );

    return `http://${serverApiContainer.getHost()}:${serverApiContainer.getMappedPort(SERVER_API_CONTAINER_PORT)}`;
  }
}

export { DockerComposeEnvironment };
