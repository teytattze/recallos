import type { JsonObject } from "type-fest";

type MongodbEventModel = {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  tenant: string;

  external: {
    id: string;
    provider: "jira";
  };
  graphId: string;
  raw: JsonObject;
};

export type { MongodbEventModel };
