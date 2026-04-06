import { test, expect } from "bun:test";
import { diffFiles } from "./incremental-index";

test("files on disk not in state are added", () => {
  const result = diffFiles([{ path: "src/a.ts", hash: "h1" }], []);
  expect(result.added).toEqual(["src/a.ts"]);
  expect(result.modified).toEqual([]);
  expect(result.deleted).toEqual([]);
  expect(result.unchanged).toEqual([]);
});

test("files in state not on disk are deleted", () => {
  const result = diffFiles([], [{ filePath: "src/a.ts", contentHash: "h1" }]);
  expect(result.deleted).toEqual(["src/a.ts"]);
  expect(result.added).toEqual([]);
  expect(result.modified).toEqual([]);
  expect(result.unchanged).toEqual([]);
});

test("files with different hash are modified", () => {
  const result = diffFiles(
    [{ path: "src/a.ts", hash: "h2" }],
    [{ filePath: "src/a.ts", contentHash: "h1" }],
  );
  expect(result.modified).toEqual(["src/a.ts"]);
  expect(result.added).toEqual([]);
  expect(result.deleted).toEqual([]);
  expect(result.unchanged).toEqual([]);
});

test("files with same hash are unchanged", () => {
  const result = diffFiles(
    [{ path: "src/a.ts", hash: "h1" }],
    [{ filePath: "src/a.ts", contentHash: "h1" }],
  );
  expect(result.unchanged).toEqual(["src/a.ts"]);
  expect(result.added).toEqual([]);
  expect(result.modified).toEqual([]);
  expect(result.deleted).toEqual([]);
});

test("mixed scenario classifies correctly", () => {
  const result = diffFiles(
    [
      { path: "src/a.ts", hash: "h1" }, // unchanged
      { path: "src/b.ts", hash: "h2_new" }, // modified
      { path: "src/d.ts", hash: "h4" }, // added
    ],
    [
      { filePath: "src/a.ts", contentHash: "h1" },
      { filePath: "src/b.ts", contentHash: "h2_old" },
      { filePath: "src/c.ts", contentHash: "h3" }, // deleted
    ],
  );
  expect(result.added).toEqual(["src/d.ts"]);
  expect(result.modified).toEqual(["src/b.ts"]);
  expect(result.deleted).toEqual(["src/c.ts"]);
  expect(result.unchanged).toEqual(["src/a.ts"]);
});

test("empty disk + populated state = all deleted", () => {
  const result = diffFiles(
    [],
    [
      { filePath: "src/a.ts", contentHash: "h1" },
      { filePath: "src/b.ts", contentHash: "h2" },
    ],
  );
  expect(result.deleted).toEqual(["src/a.ts", "src/b.ts"]);
  expect(result.added).toEqual([]);
});

test("populated disk + empty state = all added", () => {
  const result = diffFiles(
    [
      { path: "src/a.ts", hash: "h1" },
      { path: "src/b.ts", hash: "h2" },
    ],
    [],
  );
  expect(result.added).toEqual(["src/a.ts", "src/b.ts"]);
  expect(result.deleted).toEqual([]);
});
