import { test, expect } from "bun:test";
import { resolveSpecifier } from "@/codebase/graph/resolver";

const makeFileExists = (paths: string[]) => {
  const set = new Set(paths);
  return (p: string) => set.has(p);
};

const PROJECT_ROOT = "/project";

test("resolveSpecifier: given relative specifier, resolves to .ts file", () => {
  const exists = makeFileExists(["/project/src/foo.ts"]);
  const result = resolveSpecifier(
    "./foo",
    "src/bar.ts",
    PROJECT_ROOT,
    undefined,
    exists,
  );
  expect(result).toBe("src/foo.ts");
});

test("resolveSpecifier: given relative specifier, resolves to .tsx file", () => {
  const exists = makeFileExists(["/project/src/Component.tsx"]);
  const result = resolveSpecifier(
    "./Component",
    "src/App.tsx",
    PROJECT_ROOT,
    undefined,
    exists,
  );
  expect(result).toBe("src/Component.tsx");
});

test("resolveSpecifier: given relative specifier, resolves to index.ts", () => {
  const exists = makeFileExists(["/project/src/utils/index.ts"]);
  const result = resolveSpecifier(
    "./utils",
    "src/foo.ts",
    PROJECT_ROOT,
    undefined,
    exists,
  );
  expect(result).toBe("src/utils/index.ts");
});

test("resolveSpecifier: given alias specifier, maps through alias", () => {
  const exists = makeFileExists(["/project/src/db/schema.ts"]);
  const result = resolveSpecifier(
    "@/db/schema",
    "src/codebase/indexing.ts",
    PROJECT_ROOT,
    undefined,
    exists,
  );
  expect(result).toBe("src/db/schema.ts");
});

test("resolveSpecifier: given external package, returns null", () => {
  const exists = makeFileExists([]);
  const result = resolveSpecifier(
    "drizzle-orm",
    "src/foo.ts",
    PROJECT_ROOT,
    undefined,
    exists,
  );
  expect(result).toBeNull();
});

test("resolveSpecifier: given unresolvable relative path, returns null", () => {
  const exists = makeFileExists([]);
  const result = resolveSpecifier(
    "./nonexistent",
    "src/foo.ts",
    PROJECT_ROOT,
    undefined,
    exists,
  );
  expect(result).toBeNull();
});

test("resolveSpecifier: given parent directory import, resolves correctly", () => {
  const exists = makeFileExists(["/project/src/lib/util.ts"]);
  const result = resolveSpecifier(
    "../lib/util",
    "src/codebase/indexing.ts",
    PROJECT_ROOT,
    undefined,
    exists,
  );
  expect(result).toBe("src/lib/util.ts");
});
