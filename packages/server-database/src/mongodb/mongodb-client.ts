import { MongoClient } from "mongodb";

type CreateMongodbClientInput = {
  url: string;
};

const createMongodbClient = (input: CreateMongodbClientInput): MongoClient => {
  return new MongoClient(input.url);
};

export { createMongodbClient };
