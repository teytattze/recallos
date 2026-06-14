type MongodbWebhookSubscriptionModel = {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  tenant: string;

  provider: "jira";
  context: {
    _id: string;
    createdAt: Date;
    updatedAt: Date;

    graphId: string;
  };
  secret: {
    _id: string;
    createdAt: Date;
    updatedAt: Date;

    algorithm: "hmac_sha256";
    value: string;
  };
};

export type { MongodbWebhookSubscriptionModel };
