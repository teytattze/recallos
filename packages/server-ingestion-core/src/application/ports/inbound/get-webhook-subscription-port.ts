type GetWebhookSubscriptionPortInput = {
  id: string;
  tenant: string;
};

type GetWebhookSubscriptionPortOutput = Promise<{
  id: string;
  tenant: string;
  createdAt: Date;
  updatedAt: Date;
  provider: "jira";
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
