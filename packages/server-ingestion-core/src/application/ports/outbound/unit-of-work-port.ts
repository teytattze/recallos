import type { EventRepositoryPort } from "./event-repository-port.ts";
import type { WebhookSubscriptionRepositoryPort } from "./webhook-subscription-repository-port.ts";

interface UnitOfWorkPortContext {
  eventRepository: EventRepositoryPort;
  webhookSubscriptionRepository: WebhookSubscriptionRepositoryPort;
}

interface UnitOfWorkPort {
  transaction<T>(work: (ctx: UnitOfWorkPortContext) => Promise<T>): Promise<T>;
}

export type { UnitOfWorkPortContext, UnitOfWorkPort };
