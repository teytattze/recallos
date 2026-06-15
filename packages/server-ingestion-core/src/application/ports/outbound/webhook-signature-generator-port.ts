import type { WebhookSecret } from "../../../domain/entities/webhook-secret";

type WebhookSignatureGeneratorPortGenerateInput = {
  secret: WebhookSecret;
  payload: string;
};
type WebhookSignatureGeneratorPortGenerateOutput = string;

interface WebhookSignatureGeneratorPort {
  generate(
    input: WebhookSignatureGeneratorPortGenerateInput,
  ): WebhookSignatureGeneratorPortGenerateOutput;
}

export type {
  WebhookSignatureGeneratorPort,
  WebhookSignatureGeneratorPortGenerateInput,
  WebhookSignatureGeneratorPortGenerateOutput,
};
