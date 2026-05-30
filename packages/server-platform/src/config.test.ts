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

test("loadConfig: given a missing DATABASE_URL, it should throw", () => {
  expect(() => loadConfig({})).toThrow(/Invalid environment configuration/);
});

test("loadConfig: given an unparseable PORT, it should throw", () => {
  expect(() => loadConfig({ PORT: "abc" })).toThrow(
    /Invalid environment configuration/,
  );
});

test("loadConfig: given an unknown NODE_ENV, it should throw", () => {
  expect(() => loadConfig({ NODE_ENV: "staging" })).toThrow();
});
