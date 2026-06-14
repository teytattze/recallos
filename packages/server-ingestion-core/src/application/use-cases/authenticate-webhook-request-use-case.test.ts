import { expect, test } from "bun:test";

import type { WebhookSubscription } from "../../domain/aggregates/webhook-subscription.ts";
import type {
  WebhookSignatureGeneratorPort,
  WebhookSignatureGeneratorPortGenerateInput,
  WebhookSignatureGeneratorPortGenerateOutput,
} from "../ports/outbound/webhook-signature-generator-port.ts";
import type {
  WebhookSubscriptionRepositoryPort,
  WebhookSubscriptionRepositoryPortFindByIdInput,
  WebhookSubscriptionRepositoryPortFindByIdOutput,
  WebhookSubscriptionRepositoryPortInsertInput,
  WebhookSubscriptionRepositoryPortInsertOutput,
} from "../ports/outbound/webhook-subscription-repository-port.ts";

import { WebhookSubscription as WebhookSubscriptionAggregate } from "../../domain/aggregates/webhook-subscription.ts";
import { AuthenticateWebhookRequestUseCase } from "./authenticate-webhook-request-use-case.ts";

class FakeWebhookSubscriptionRepository implements WebhookSubscriptionRepositoryPort {
  readonly findByIdInputs: WebhookSubscriptionRepositoryPortFindByIdInput[] =
    [];

  constructor(private readonly found: WebhookSubscription | null) {}

  findById(
    input: WebhookSubscriptionRepositoryPortFindByIdInput,
  ): WebhookSubscriptionRepositoryPortFindByIdOutput {
    this.findByIdInputs.push(input);
    return Promise.resolve(this.found);
  }

  insert(
    _input: WebhookSubscriptionRepositoryPortInsertInput,
  ): WebhookSubscriptionRepositoryPortInsertOutput {
    throw new Error("Unexpected insert");
  }
}

class FakeWebhookSignatureGenerator implements WebhookSignatureGeneratorPort {
  readonly generateInputs: WebhookSignatureGeneratorPortGenerateInput[] = [];

  constructor(
    private readonly generated: WebhookSignatureGeneratorPortGenerateOutput,
  ) {}

  generate(
    input: WebhookSignatureGeneratorPortGenerateInput,
  ): WebhookSignatureGeneratorPortGenerateOutput {
    this.generateInputs.push(input);
    return this.generated;
  }
}

const id = "webhook-subscription-1";
const tenant = "organization:org1";
const incomingBody = JSON.stringify({ issue: { key: "REC-123" } });
const expectedSignature = "expected-signature";
const createdAt = new Date("2026-01-02T00:00:00Z");
const updatedAt = new Date("2026-01-03T00:00:00Z");

const createWebhookSubscription = () =>
  WebhookSubscriptionAggregate.restore({
    tenant,
    metadata: { createdAt, updatedAt },
    payload: {
      id,
      provider: "jira",
      context: {
        metadata: { createdAt, updatedAt },
        payload: {
          id: "webhook-subscription-context-1",
          graphId: "graph-1",
        },
      },
      secret: {
        metadata: { createdAt, updatedAt },
        payload: {
          id: "webhook-secret-1",
          algorithm: "hmac_sha256",
          value: "stored-secret-value",
        },
      },
    },
  });

test("AuthenticateWebhookRequestUseCase.execute: given a valid signature, it should resolve without returning a value", async () => {
  // GIVEN
  const webhookSubscription = createWebhookSubscription();
  const repository = new FakeWebhookSubscriptionRepository(webhookSubscription);
  const signatureGenerator = new FakeWebhookSignatureGenerator(
    expectedSignature,
  );
  const useCase = new AuthenticateWebhookRequestUseCase(
    repository,
    signatureGenerator,
  );

  // WHEN
  const result = await useCase.execute({
    tenant,
    payload: {
      id,
      provider: "jira",
      incomingSignature: expectedSignature,
      incomingBody,
    },
  });

  // THEN
  expect(result).toBeUndefined();
  expect(repository.findByIdInputs.length).toBe(1);
  expect(repository.findByIdInputs[0]!.id.toString()).toBe(id);
  expect(repository.findByIdInputs[0]!.tenant.toString()).toBe(tenant);
  expect(signatureGenerator.generateInputs).toEqual([
    { secret: webhookSubscription.secret, payload: incomingBody },
  ]);
});

test("AuthenticateWebhookRequestUseCase.execute: given a missing subscription, it should throw an invalid authentication error", async () => {
  // GIVEN
  const repository = new FakeWebhookSubscriptionRepository(null);
  const signatureGenerator = new FakeWebhookSignatureGenerator(
    expectedSignature,
  );
  const useCase = new AuthenticateWebhookRequestUseCase(
    repository,
    signatureGenerator,
  );

  // WHEN
  const error = await useCase
    .execute({
      tenant,
      payload: {
        id,
        provider: "jira",
        incomingSignature: expectedSignature,
        incomingBody,
      },
    })
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toMatchObject({
    kind: "InvalidWebhookAuthentication",
    category: "forbidden",
  });
  expect(repository.findByIdInputs.length).toBe(1);
  expect(repository.findByIdInputs[0]!.id.toString()).toBe(id);
  expect(repository.findByIdInputs[0]!.tenant.toString()).toBe(tenant);
  expect(signatureGenerator.generateInputs.length).toBe(0);
});

test("AuthenticateWebhookRequestUseCase.execute: given a same-length invalid signature, it should throw an invalid authentication error", async () => {
  // GIVEN
  const repository = new FakeWebhookSubscriptionRepository(
    createWebhookSubscription(),
  );
  const signatureGenerator = new FakeWebhookSignatureGenerator(
    expectedSignature,
  );
  const useCase = new AuthenticateWebhookRequestUseCase(
    repository,
    signatureGenerator,
  );

  // WHEN
  const error = await useCase
    .execute({
      tenant,
      payload: {
        id,
        provider: "jira",
        incomingSignature: "Expected-signature",
        incomingBody,
      },
    })
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toMatchObject({
    kind: "InvalidWebhookAuthentication",
    category: "forbidden",
  });
  expect(error).not.toBeInstanceOf(RangeError);
  expect(signatureGenerator.generateInputs.length).toBe(1);
});
