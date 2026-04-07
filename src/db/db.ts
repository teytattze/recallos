import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";
import "dotenv/config";
import { SQL } from "bun";

const client = new SQL(process.env.DATABASE_URL!);

const db = drizzle({ client, schema });

export { db };
