import { AppError } from "@repo/app-error";
import { expect, test } from "bun:test";

import type {
  WebhookSubscriptionRepositoryPort,
  WebhookSubscriptionRepositoryPortFindByIdInput,
  WebhookSubscriptionRepositoryPortFindByIdOutput,
  WebhookSubscriptionRepositoryPortInsertInput,
  WebhookSubscriptionRepositoryPortInsertOutput,
} from "../ports/outbound/webhook-subscription-repository-port.ts";

import { WebhookSubscription } from "../../domain/aggregates/webhook-subscription.ts";
import { GetWebhookSubscriptionUseCase } from "./get-webhook-subscription-use-case.ts";

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

const id = "webhook-subscription-1";
const tenant = "organization:org1";
const createdAt = new Date("2026-01-02T00:00:00Z");
const updatedAt = new Date("2026-01-03T00:00:00Z");
const secretId = "webhook-secret-1";
const secretCreatedAt = new Date("2026-01-04T00:00:00Z");
const secretUpdatedAt = new Date("2026-01-05T00:00:00Z");
const graphId = "graph-1";
const contextId = "webhook-subscription-context-1";
const contextCreatedAt = new Date("2026-01-06T00:00:00Z");
const contextUpdatedAt = new Date("2026-01-07T00:00:00Z");

test("GetWebhookSubscriptionUseCase.execute: given an existing subscription, it should return a plain object without the secret value", async () => {
  // GIVEN
  const webhookSubscription = WebhookSubscription.restore({
    tenant,
    metadata: { createdAt, updatedAt },
    payload: {
      id,
      provider: "jira",
      context: {
        metadata: {
          createdAt: contextCreatedAt,
          updatedAt: contextUpdatedAt,
        },
        payload: { id: contextId, graphId },
      },
      secret: {
        metadata: {
          createdAt: secretCreatedAt,
          updatedAt: secretUpdatedAt,
        },
        payload: {
          id: secretId,
          algorithm: "hmac_sha256",
          value: "stored-secret-value",
        },
      },
    },
  });
  const repository = new FakeWebhookSubscriptionRepository(webhookSubscription);
  const useCase = new GetWebhookSubscriptionUseCase(repository);

  // WHEN
  const result = await useCase.execute({ tenant, payload: { id } });

  // THEN
  expect(repository.findByIdInputs.length).toBe(1);
  expect(repository.findByIdInputs[0]!.id.toString()).toBe(id);
  expect(repository.findByIdInputs[0]!.tenant.toString()).toBe(tenant);
  expect(result).toEqual({
    id,
    tenant,
    createdAt,
    updatedAt,
    provider: "jira",
    context: {
      id: contextId,
      createdAt: contextCreatedAt,
      updatedAt: contextUpdatedAt,
      graphId,
    },
    secret: {
      id: secretId,
      createdAt: secretCreatedAt,
      updatedAt: secretUpdatedAt,
      algorithm: "hmac_sha256",
    },
  });
  expect("value" in result.secret).toBe(false);
});

test("GetWebhookSubscriptionUseCase.execute: given a missing subscription, it should throw a not-found error", async () => {
  // GIVEN
  const repository = new FakeWebhookSubscriptionRepository(null);
  const useCase = new GetWebhookSubscriptionUseCase(repository);

  // WHEN
  const error = await useCase
    .execute({ tenant, payload: { id } })
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toBeInstanceOf(AppError);
  const appError = AppError.from(error);
  expect(appError.code).toBe("serverIngestionCore.webhookSubscriptionNotFound");
  expect(appError.details).toEqual({ id, tenant });
  expect(repository.findByIdInputs.length).toBe(1);
  expect(repository.findByIdInputs[0]!.id.toString()).toBe(id);
  expect(repository.findByIdInputs[0]!.tenant.toString()).toBe(tenant);
});
