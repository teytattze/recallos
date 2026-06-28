import { expect, test } from "bun:test";
import { z } from "zod";

import { defineConfig } from "./define-config.ts";

const createBase = () => ({
  local: {
    app: {
      name: "local-api",
      http: { port: 3000 },
    },
    database: {
      url: "https://local.example.com",
      databaseName: "local",
    },
  },
  test: {
    app: {
      name: "test-api",
      http: { port: 3001 },
    },
    database: {
      url: "https://test.example.com",
      databaseName: "test",
    },
  },
  staging: {
    app: {
      name: "staging-api",
      http: { port: 3002 },
    },
    database: {
      url: "https://staging.example.com",
      databaseName: "staging",
    },
  },
  production: {
    app: {
      name: "production-api",
      http: { port: 3003 },
    },
    database: {
      url: "https://production.example.com",
      databaseName: "production",
    },
  },
});

const configSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    http: z.object({
      port: z.coerce.number().int().positive(),
    }),
  }),
  database: z.object({
    url: z.url(),
    databaseName: z.string().min(1),
  }),
});

test("defineConfig: given an active environment, it should merge that environment's base config with runtime values", () => {
  // GIVEN
  const runtime = {
    database: {
      url: "https://runtime.example.com",
    },
  };

  // WHEN
  const config = defineConfig({
    schema: configSchema,
    base: createBase(),
    runtime,
  })("local");

  // THEN
  expect(config).toEqual({
    app: {
      name: "local-api",
      http: { port: 3000 },
    },
    database: {
      url: "https://runtime.example.com",
      databaseName: "local",
    },
  });
});

test("defineConfig: given runtime string values and a coercing schema, it should return parsed output values", () => {
  // GIVEN
  const runtime = {
    app: {
      http: { port: "4141" },
    },
  };

  // WHEN
  const config = defineConfig({
    schema: configSchema,
    base: createBase(),
    runtime,
  })("test");

  // THEN
  expect(config.app.http.port).toBe(4141);
});

test("defineConfig: given invalid merged config, it should throw the schema validation error", () => {
  // GIVEN
  const runtime = {
    database: {
      url: "not-a-url",
    },
  };

  // WHEN
  const parseConfig = () =>
    defineConfig({
      schema: configSchema,
      base: createBase(),
      runtime,
    })("local");

  // THEN
  expect(parseConfig).toThrow(z.ZodError);
});

test("defineConfig: given multiple base environments, it should only use the active environment's base values", () => {
  // GIVEN
  const base = {
    ...createBase(),
    local: {
      app: {
        name: "",
        http: { port: 3000 },
      },
      database: {
        url: "not-a-url",
        databaseName: "",
      },
    },
  };

  // WHEN
  const config = defineConfig({
    schema: configSchema,
    base,
    runtime: {},
  })("production");

  // THEN
  expect(config.app.name).toBe("production-api");
  expect(config.database.url).toBe("https://production.example.com");
});
