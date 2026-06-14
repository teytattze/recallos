import { expect, test } from "bun:test";

import { getAppMetadataConfigSchema } from "./app-metadata-config.ts";

type AppMetadataEnv = {
  APP_ENV?: string;
  APP_VERSION?: string;
  APP_IS_LOCAL?: string;
};

const withAppMetadataEnv = <T>(env: AppMetadataEnv, run: () => T): T => {
  const previous = {
    APP_ENV: process.env.APP_ENV,
    APP_VERSION: process.env.APP_VERSION,
    APP_IS_LOCAL: process.env.APP_IS_LOCAL,
  };
  try {
    for (const key of Object.keys(previous) as Array<keyof AppMetadataEnv>) {
      if (env[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = env[key];
      }
    }
    return run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("getAppMetadataConfigSchema: given no app metadata env, it should return defaults", () => {
  // GIVEN / WHEN
  const config = withAppMetadataEnv({}, () => getAppMetadataConfigSchema());

  // THEN
  expect(config).toEqual({
    APP_ENV: "staging",
    APP_VERSION: "0.0.0",
    APP_IS_LOCAL: true,
  });
});

test("getAppMetadataConfigSchema: given production metadata env, it should return parsed metadata", () => {
  // GIVEN / WHEN
  const config = withAppMetadataEnv(
    {
      APP_ENV: "production",
      APP_VERSION: "1.2.3",
      APP_IS_LOCAL: "",
    },
    () => getAppMetadataConfigSchema(),
  );

  // THEN
  expect(config).toEqual({
    APP_ENV: "production",
    APP_VERSION: "1.2.3",
    APP_IS_LOCAL: false,
  });
});

test("getAppMetadataConfigSchema: given an unknown APP_ENV, it should throw", () => {
  // GIVEN / WHEN / THEN
  expect(() =>
    withAppMetadataEnv(
      { APP_ENV: "development" },
      () => getAppMetadataConfigSchema(),
    ),
  ).toThrow();
});
