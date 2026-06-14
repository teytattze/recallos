type AuthenticateWebhookRequestPortInput = {
  tenant: string;
  payload: {
    id: string;
    provider: "jira";
    incomingSignature: string;
    incomingBody: string;
  };
};
type AuthenticateWebhookRequestPortOutput = Promise<void>;

interface AuthenticateWebhookRequestPort {
  execute(
    input: AuthenticateWebhookRequestPortInput,
  ): AuthenticateWebhookRequestPortOutput;
}

export type {
  AuthenticateWebhookRequestPort,
  AuthenticateWebhookRequestPortInput,
  AuthenticateWebhookRequestPortOutput,
};
