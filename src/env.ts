import "dotenv/config";
import z from "zod";

const chromadbApiKey = z.string().parse(process.env.CHROMADB_API_KEY);
const voyageaiApiKey = z.string().parse(process.env.VOYAGEAI_API_KEY);

const env = {
  chromadbApiKey,
  voyageaiApiKey,
};

export { env };
