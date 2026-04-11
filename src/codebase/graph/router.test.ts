import { test, expect, describe } from "bun:test";
import { extractImports } from "@/codebase/graph/router";

describe("extractImports", () => {
  test("given named import, returns specifier", () => {
    const code = `import { foo } from "./bar";`;
    expect(extractImports(code, "test.ts")).toEqual(["./bar"]);
  });

  test("given default import, returns specifier", () => {
    const code = `import foo from "./bar";`;
    expect(extractImports(code, "test.ts")).toEqual(["./bar"]);
  });

  test("given type import, returns specifier", () => {
    const code = `import type { Foo } from "./types";`;
    expect(extractImports(code, "test.ts")).toEqual(["./types"]);
  });

  test("given side-effect import, returns specifier", () => {
    const code = `import "./polyfill";`;
    expect(extractImports(code, "test.ts")).toEqual(["./polyfill"]);
  });

  test("given re-export, returns specifier", () => {
    const code = `export { foo } from "./bar";`;
    expect(extractImports(code, "test.ts")).toEqual(["./bar"]);
  });

  test("given star re-export, returns specifier", () => {
    const code = `export * from "./utils";`;
    expect(extractImports(code, "test.ts")).toEqual(["./utils"]);
  });

  test("given dynamic import, returns specifier", () => {
    const code = `const mod = await import("./lazy");`;
    expect(extractImports(code, "test.ts")).toEqual(["./lazy"]);
  });

  test("given multiple imports, returns all unique specifiers", () => {
    const code = `import { a } from "./foo";
import { b } from "./bar";
import { c } from "./foo";`;
    expect(extractImports(code, "test.ts")).toEqual(["./foo", "./bar"]);
  });

  test("given external package, returns it in raw output", () => {
    const code = `import { eq } from "drizzle-orm";`;
    expect(extractImports(code, "test.ts")).toEqual(["drizzle-orm"]);
  });

  test("given alias import, returns alias specifier", () => {
    const code = `import { db } from "@/db/db";`;
    expect(extractImports(code, "test.ts")).toEqual(["@/db/db"]);
  });

  test("given empty file, returns empty array", () => {
    expect(extractImports("", "test.ts")).toEqual([]);
  });

  test("given non-typescript file, returns empty array", () => {
    const code = `import foo from "./bar";`;
    expect(extractImports(code, "test.md")).toEqual([]);
  });

  test("given .tsx file, parses correctly", () => {
    const code = `import React from "react";
import { Component } from "./Component";`;
    expect(extractImports(code, "App.tsx")).toEqual(["react", "./Component"]);
  });
});
