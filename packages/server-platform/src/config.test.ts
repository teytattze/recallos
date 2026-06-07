import { test, expect } from "bun:test";

import { loadConfig } from "./config.ts";

const DATABASE_URL = "postgres://recallos:recallos@localhost:5432/recallos";

test("loadConfig: given a valid env, it should coerce PORT and apply defaults", () => {
  const config = loadConfig({
    NODE_ENV: "production",
    PORT: "8080",
    DATABASE_URL,
  });
  expect(config.NODE_ENV).toBe("production");
  expect(config.PORT).toBe(8080);
  expect(config.LOG_LEVEL).toBe("info");
});

test("loadConfig: given only the required DATABASE_URL, it should apply defaults", () => {
  const config = loadConfig({ DATABASE_URL });
  expect(config).toEqual({
    NODE_ENV: "development",
    LOG_LEVEL: "info",
    PORT: 8000,
    DATABASE_URL,
  });
});

test.each([
  ["a missing DATABASE_URL", {}],
  ["an unparseable PORT", { PORT: "abc" }],
  ["an unknown NODE_ENV", { NODE_ENV: "staging" }],
])("loadConfig: given %s, it should throw", (_label, env) => {
  expect(() => loadConfig(env)).toThrow(/Invalid environment configuration/);
});
