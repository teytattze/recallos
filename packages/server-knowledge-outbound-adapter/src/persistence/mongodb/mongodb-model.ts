import type { JsonObject } from "type-fest";

type MongodbGraphModel = {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  tenant: string;

  embeddingMetadata: {
    dimension: "1024";
    model: "voyage-4-large";
  };
};

type MongodbGraphNodeModel = {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  tenant: string;

  embedding: number[];
  eventId: string;
  graphId: string;
  rawEvent: JsonObject;
};

export type { MongodbGraphModel, MongodbGraphNodeModel };
