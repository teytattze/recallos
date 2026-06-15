import type {
  WebhookSignatureGeneratorPort,
  WebhookSignatureGeneratorPortGenerateInput,
  WebhookSignatureGeneratorPortGenerateOutput,
} from "@repo/server-ingestion-core";

import { createHmac } from "node:crypto";

class NodeWebhookSignatureGenerator implements WebhookSignatureGeneratorPort {
  generate(
    input: WebhookSignatureGeneratorPortGenerateInput,
  ): WebhookSignatureGeneratorPortGenerateOutput {
    return createHmac("sha256", input.secret.value)
      .update(input.payload)
      .digest("hex");
  }
}

export { NodeWebhookSignatureGenerator };
