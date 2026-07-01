import { AppError } from "@repo/app-error";
import { createFixedClock } from "@repo/server-kernel";
import { expect, test } from "bun:test";

import type { WebhookSubscription } from "../../domain/aggregates/webhook-subscription.ts";
import type {
  EventRepositoryPort,
  EventRepositoryPortInsertInput,
  EventRepositoryPortInsertOutput,
} from "../ports/outbound/event-repository-port.ts";
import type {
  UnitOfWorkPort,
  UnitOfWorkPortContext,
} from "../ports/outbound/unit-of-work-port.ts";
import type { WebhookSecretGeneratorPort } from "../ports/outbound/webhook-secret-generator-port.ts";
import type {
  WebhookSubscriptionRepositoryPort,
  WebhookSubscriptionRepositoryPortFindByIdInput,
  WebhookSubscriptionRepositoryPortFindByIdOutput,
  WebhookSubscriptionRepositoryPortInsertInput,
  WebhookSubscriptionRepositoryPortInsertOutput,
} from "../ports/outbound/webhook-subscription-repository-port.ts";

import { CreateWebhookSubscriptionUseCase } from "./create-webhook-endpoint-use-case.ts";

class FakeEventRepository implements EventRepositoryPort {
  insert(
    _input: EventRepositoryPortInsertInput,
  ): EventRepositoryPortInsertOutput {
    throw new Error("Unexpected event insert");
  }
}

class FakeWebhookSubscriptionRepository implements WebhookSubscriptionRepositoryPort {
  readonly inserted: WebhookSubscription[] = [];

  findById(
    _input: WebhookSubscriptionRepositoryPortFindByIdInput,
  ): WebhookSubscriptionRepositoryPortFindByIdOutput {
    throw new Error("Unexpected webhook subscription lookup");
  }

  insert(
    input: WebhookSubscriptionRepositoryPortInsertInput,
  ): WebhookSubscriptionRepositoryPortInsertOutput {
    this.inserted.push(input.data);
    return Promise.resolve();
  }
}

class FakeUnitOfWork implements UnitOfWorkPort {
  readonly events = new FakeEventRepository();
  readonly webhookSubscriptions = new FakeWebhookSubscriptionRepository();
  ran = 0;

  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T> {
    this.ran += 1;
    return work({
      eventRepository: this.events,
      webhookSubscriptionRepository: this.webhookSubscriptions,
    });
  }
}

class FakeWebhookSecretGenerator implements WebhookSecretGeneratorPort {
  generated = 0;

  constructor(private readonly value: string) {}

  generate(): string {
    this.generated += 1;
    return this.value;
  }
}

const now = new Date("2026-01-01T00:00:00Z");
const validInput = {
  tenant: "organization:org1",
  payload: {
    provider: "jira",
    context: { graphId: "graph-1" },
    secret: { algorithm: "hmac_sha256" },
  },
} as const;

test("CreateWebhookSubscriptionUseCase.execute: given valid input, it should create and insert a webhook subscription", async () => {
  // GIVEN
  const unitOfWork = new FakeUnitOfWork();
  const secretGenerator = new FakeWebhookSecretGenerator("secret-value");
  const useCase = new CreateWebhookSubscriptionUseCase(
    createFixedClock(now),
    unitOfWork,
    secretGenerator,
  );

  // WHEN
  const result = await useCase.execute(validInput);

  // THEN
  expect(unitOfWork.ran).toBe(1);
  expect(secretGenerator.generated).toBe(1);
  expect(unitOfWork.webhookSubscriptions.inserted.length).toBe(1);
  expect(result).toEqual({
    id: unitOfWork.webhookSubscriptions.inserted[0]!.id.toString(),
    secret: { algorithm: "hmac_sha256", value: "secret-value" },
  });
  expect(unitOfWork.webhookSubscriptions.inserted[0]!.tenant.toString()).toBe(
    validInput.tenant,
  );
  expect(
    unitOfWork.webhookSubscriptions.inserted[0]!.metadata.createdAt,
  ).toEqual(now);
  expect(String(unitOfWork.webhookSubscriptions.inserted[0]!.provider)).toBe(
    "jira",
  );
  expect(
    unitOfWork.webhookSubscriptions.inserted[0]!.context.graphId.value,
  ).toBe(validInput.payload.context.graphId);
});

test("CreateWebhookSubscriptionUseCase.execute: given an invalid tenant, it should throw without inserting", async () => {
  // GIVEN
  const unitOfWork = new FakeUnitOfWork();
  const secretGenerator = new FakeWebhookSecretGenerator("secret-value");
  const useCase = new CreateWebhookSubscriptionUseCase(
    createFixedClock(now),
    unitOfWork,
    secretGenerator,
  );

  // WHEN
  const error = await useCase
    .execute({ ...validInput, tenant: "organization" })
    .catch((caught: unknown) => caught);

  // THEN
  expect(error).toBeInstanceOf(AppError);
  expect(AppError.from(error).code).toBe("invariantViolation");
  expect(unitOfWork.ran).toBe(0);
  expect(secretGenerator.generated).toBe(0);
  expect(unitOfWork.webhookSubscriptions.inserted.length).toBe(0);
});
