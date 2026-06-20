import { addSeconds, isFuture } from "date-fns";
import { attemptAsync, delay, invariant } from "es-toolkit";
import { GenericContainer, type StartedTestContainer } from "testcontainers";

const MONGO_CONTAINER_IMAGE = "mongo:8";
const MONGO_CONTAINER_PORT = 27017;
const MONGO_CONTAINER_REPLICA_SET_NAME = "rs0";
const MONGO_CONTAINER_STARTUP_TIMEOUT_MS = 60000;

const ERROR_MESSAGE_UNDEFINED_CONTAINER =
  "The Mongo container is undefined. Please ensure it is initialized properly";

class MongoContainer {
  #container: StartedTestContainer | undefined;

  async init() {
    this.#container = await new GenericContainer(MONGO_CONTAINER_IMAGE)
      .withExposedPorts(MONGO_CONTAINER_PORT)
      .withCommand([
        "--replSet",
        MONGO_CONTAINER_REPLICA_SET_NAME,
        "--bind_ip_all",
      ])
      .withStartupTimeout(MONGO_CONTAINER_STARTUP_TIMEOUT_MS)
      .start();

    try {
      const initiateResult = await this.#container.exec([
        "mongosh",
        "--quiet",
        "--eval",
        `rs.initiate({_id:'${MONGO_CONTAINER_REPLICA_SET_NAME}',members:[{_id:0,host:'localhost:${MONGO_CONTAINER_PORT}'}]}).ok`,
      ]);

      if (initiateResult.exitCode !== 0) {
        throw new Error(
          `Failed to initiate MongoDB replica set: ${initiateResult.output}`,
        );
      }

      let isWritablePrimary = false;
      const deadline = addSeconds(new Date(), 20);

      while (isFuture(deadline) && !isWritablePrimary) {
        const result = await this.#container.exec([
          "mongosh",
          "--quiet",
          "--eval",
          "db.hello().isWritablePrimary",
        ]);

        if (result.exitCode === 0 && result.output.trim() === "true") {
          isWritablePrimary = true;
          break;
        }
        await delay(100);
      }

      if (!isWritablePrimary) {
        throw new Error("MongoDB replica set did not elect a primary");
      }
    } catch (error) {
      const [cleanUpError] = await attemptAsync(
        async () => await this.cleanUp(),
      );

      if (cleanUpError === undefined || cleanUpError === null) {
        throw error;
      }
      throw new AggregateError(
        [error, cleanUpError],
        "MongoDB start-up and clean-up failed",
      );
    }
  }

  async cleanUp() {
    await this.#container?.stop();
    this.#container = undefined;
  }

  get container() {
    invariant(this.#container !== undefined, ERROR_MESSAGE_UNDEFINED_CONTAINER);
    return this.#container;
  }
  get url() {
    invariant(this.#container !== undefined, ERROR_MESSAGE_UNDEFINED_CONTAINER);
    return `mongodb://${this.#container.getHost()}:${this.#container.getMappedPort(MONGO_CONTAINER_PORT)}/?directConnection=true&replicaSet=${MONGO_CONTAINER_REPLICA_SET_NAME}`;
  }
}

export { MongoContainer };
