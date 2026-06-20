import type { Schema } from "convict";

import { describe, expect, test } from "bun:test";

import { createConfig } from "./config.ts";

type TestConfig = {
  app: {
    environment: string;
    port: number;
  };
};

const schema: Schema<TestConfig> = {
  app: {
    environment: {
      format: ["local", "production"],
      default: "local",
      env: "APP_ENV",
    },
    port: {
      format: "port",
      default: 8000,
      env: "APP_PORT",
    },
  },
};

const profiles = {
  local: { app: { port: 3000 } },
  production: {},
};

const parser = {
  parse(value: unknown): TestConfig {
    const config = value as TestConfig;

    if (config.app.port === 3001) {
      throw new Error("Rejected by final parser");
    }

    return { ...config, app: { ...config.app, port: config.app.port + 1 } };
  },
};

describe("createConfig", () => {
  test("loads the default profile and applies the final parser", () => {
    const config = createConfig({ schema, parser, profiles, env: {} });

    expect(config).toEqual({
      app: { environment: "local", port: 3001 },
    });
  });

  test("allows environment variables to override profile values", () => {
    const config = createConfig({
      schema,
      parser,
      profiles,
      env: { APP_PORT: "4000" },
    });

    expect(config.app.port).toBe(4001);
  });

  test("rejects unsupported environments", () => {
    expect(() =>
      createConfig({
        schema,
        parser,
        profiles,
        env: { APP_ENV: "development" },
      }),
    ).toThrow("Unsupported APP_ENV");
  });

  test("strictly rejects unknown profile properties", () => {
    expect(() =>
      createConfig({
        schema,
        parser,
        profiles: {
          ...profiles,
          local: { app: { unknown: true } },
        },
        env: {},
      }),
    ).toThrow("app.unknown");
  });

  test("propagates final parser failures", () => {
    expect(() =>
      createConfig({
        schema,
        parser,
        profiles,
        env: { APP_PORT: "3001" },
      }),
    ).toThrow("Rejected by final parser");
  });
});
