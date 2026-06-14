type CreateWebhookSubscriptionPortInput = {
  tenant: string;
  payload: {
    provider: "jira";
    secret: { algorithm: "hmac_sha256" };
  };
};
type CreateWebhookSubscriptionPortOutput = Promise<{
  id: string;
  secret: { algorithm: "hmac_sha256"; value: string };
}>;

interface CreateWebhookSubscriptionPort {
  execute(
    input: CreateWebhookSubscriptionPortInput,
  ): CreateWebhookSubscriptionPortOutput;
}

export type {
  CreateWebhookSubscriptionPort,
  CreateWebhookSubscriptionPortInput,
  CreateWebhookSubscriptionPortOutput,
};
