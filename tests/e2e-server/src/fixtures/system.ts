import { type APIRequestContext, test as base } from "playwright/test";

import { DockerComposeEnvironment } from "../support/docker-compose-environment.js";
import { HttpApiClient } from "../support/http-api-client.js";
import { MongoDatabase } from "../support/mongo-database.js";

const DATABASE_NAME = "recallos-system-test";

type SystemHarness = {
  api: APIRequestContext;
  database: MongoDatabase;
};

const test = base.extend<{}, { system: SystemHarness }>({
  system: [
    async ({ playwright }, use) => {
      const dockerComposeEnvironment = new DockerComposeEnvironment();
      const mongoDatabase = new MongoDatabase();
      const httpApiClient = new HttpApiClient();

      try {
        await dockerComposeEnvironment.init();

        await mongoDatabase.init({
          url: dockerComposeEnvironment.mongodbUrl,
          databaseDefs: [
            {
              name: DATABASE_NAME,
              collectionDefs: [
                { name: "events", indexes: [] },
                { name: "graphs", indexes: [] },
                { name: "webhook-subscriptions", indexes: [] },
              ],
            },
          ],
        });
        await httpApiClient.init({
          baseUrl: dockerComposeEnvironment.serverApiUrl,
          request: playwright.request,
        });

        await use({
          api: httpApiClient.api,
          database: mongoDatabase,
        });
      } finally {
        await httpApiClient.cleanUp();
        await mongoDatabase.cleanUp();
        await dockerComposeEnvironment.cleanUp();
      }
    },
    { scope: "worker", timeout: 90_000 },
  ],
});

export { test };
export type { SystemHarness };
