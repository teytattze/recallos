import { Entity, EntityMetadata, parseProps } from "@repo/server-kernel";
import { z } from "zod";

import { GraphId } from "../value-objects/graph-id";
import { WebhookSubscriptionContextId } from "../value-objects/webhook-subscription-context-id";

const webhookSubscriptionContextPropsSchema = z.object({
  graphId: z.custom<GraphId>((v) => v instanceof GraphId),
});

type WebhookSubscriptionContextProps = z.output<
  typeof webhookSubscriptionContextPropsSchema
>;

type WebhookSubscriptionContextPropsIn = {
  graphId: string;
};

type CreateWebhookSubscriptionContextInput = {
  metadata: {
    now: Date;
  };
  payload: WebhookSubscriptionContextPropsIn;
};

type RestoreWebhookSubscriptionContextInput = {
  metadata: {
    createdAt: Date;
    updatedAt: Date;
  };
  payload: WebhookSubscriptionContextPropsIn & {
    id: string;
  };
};

class WebhookSubscriptionContext extends Entity<
  WebhookSubscriptionContextId,
  WebhookSubscriptionContextProps
> {
  static create(input: CreateWebhookSubscriptionContextInput) {
    return new WebhookSubscriptionContext(
      WebhookSubscriptionContextId.create(),
      EntityMetadata.create({ payload: input.metadata }),
      parseProps(webhookSubscriptionContextPropsSchema, {
        graphId: GraphId.restore({ payload: input.payload.graphId }),
      }),
    );
  }

  static restore(input: RestoreWebhookSubscriptionContextInput) {
    return new WebhookSubscriptionContext(
      WebhookSubscriptionContextId.restore({ payload: input.payload.id }),
      EntityMetadata.restore({ payload: input.metadata }),
      parseProps(webhookSubscriptionContextPropsSchema, {
        graphId: GraphId.restore({ payload: input.payload.graphId }),
      }),
    );
  }

  get graphId(): GraphId {
    return this._props.graphId;
  }
}

export { WebhookSubscriptionContext };
export type {
  CreateWebhookSubscriptionContextInput,
  RestoreWebhookSubscriptionContextInput,
};
