import z from "zod";

const env = {
  voyageaiApiKey: z.string().parse(process.env.VOYAGEAI_API_KEY),
  databaseUrl: z.string().parse(process.env.DATABASE_URL),
};

export { env };
