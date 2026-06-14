type MongodbWebhookSubscriptionModel = {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  tenant: string;

  provider: "jira";
  secret: {
    _id: string;
    createdAt: Date;
    updatedAt: Date;

    algorithm: "hmac_sha256";
    value: string;
  };
};

export type { MongodbWebhookSubscriptionModel };
