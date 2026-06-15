import { expect, test } from "bun:test";

import { getCommonHttpConfig } from "./common-http-config.ts";

const withHttpPort = <T>(value: string | undefined, run: () => T): T => {
  const previous = process.env.HTTP_PORT;
  try {
    if (value === undefined) {
      delete process.env.HTTP_PORT;
    } else {
      process.env.HTTP_PORT = value;
    }
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.HTTP_PORT;
    } else {
      process.env.HTTP_PORT = previous;
    }
  }
};

test("getCommonHttpConfig: given no HTTP_PORT, it should return the default port", () => {
  // GIVEN / WHEN
  const config = withHttpPort(undefined, () => getCommonHttpConfig());

  // THEN
  expect(config).toEqual({ HTTP_PORT: 8000 });
});

test("getCommonHttpConfig: given a numeric HTTP_PORT, it should return that port", () => {
  // GIVEN / WHEN
  const config = withHttpPort("3001", () => getCommonHttpConfig());

  // THEN
  expect(config).toEqual({ HTTP_PORT: 3001 });
});

test.each(["0", "-1", "1.5"])(
  "getCommonHttpConfig: given invalid HTTP_PORT %s, it should throw",
  (port) => {
    // GIVEN / WHEN / THEN
    expect(() => withHttpPort(port, () => getCommonHttpConfig())).toThrow();
  },
);
