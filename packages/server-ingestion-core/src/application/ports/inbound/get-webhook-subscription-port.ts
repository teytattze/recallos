type GetWebhookSubscriptionPortInput = {
  tenant: string;
  payload: {
    id: string;
  };
};

type GetWebhookSubscriptionPortOutput = Promise<{
  id: string;
  tenant: string;
  createdAt: Date;
  updatedAt: Date;
  provider: "jira";
  context: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    graphId: string;
  };
  secret: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    algorithm: "hmac_sha256";
  };
}>;

interface GetWebhookSubscriptionPort {
  execute(
    input: GetWebhookSubscriptionPortInput,
  ): GetWebhookSubscriptionPortOutput;
}

export type {
  GetWebhookSubscriptionPort,
  GetWebhookSubscriptionPortInput,
  GetWebhookSubscriptionPortOutput,
};
