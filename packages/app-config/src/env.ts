import z from "zod";

const envs = ["local", "test", "staging", "production"] as const;
const envSchema = z.enum(envs);

type Env = z.infer<typeof envSchema>;

export { envSchema, envs };
export type { Env };
