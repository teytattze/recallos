import { test, expect } from "bun:test";

import { loadConfig } from "./config.ts";

test("loadConfig: given a valid env, it should coerce PORT and apply defaults", () => {
  const config = loadConfig({ NODE_ENV: "production", PORT: "8080" });
  expect(config.NODE_ENV).toBe("production");
  expect(config.PORT).toBe(8080);
  expect(config.LOG_LEVEL).toBe("info");
});

test("loadConfig: given an empty env, it should apply defaults", () => {
  const config = loadConfig({});
  expect(config).toEqual({
    NODE_ENV: "development",
    LOG_LEVEL: "info",
    PORT: 3000,
  });
});

test("loadConfig: given an unparseable PORT, it should throw", () => {
  expect(() => loadConfig({ PORT: "abc" })).toThrow(
    /Invalid environment configuration/,
  );
});

test("loadConfig: given an unknown NODE_ENV, it should throw", () => {
  expect(() => loadConfig({ NODE_ENV: "staging" })).toThrow();
});
