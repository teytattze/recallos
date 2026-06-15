import type { WebhookSecretGeneratorPort } from "@repo/server-ingestion-core";

import { randomBytes } from "node:crypto";

class NodeWebhookSecretGenerator implements WebhookSecretGeneratorPort {
  generate(): string {
    const prefix = "whsec_";
    const random = randomBytes(32).toString("base64");
    return `${prefix}${random}`;
  }
}

export { NodeWebhookSecretGenerator };
