import { test, expect } from "bun:test";
import { diffFiles } from "@/codebase/indexing";

test("diffFiles: given a file on disk not in db, when diffed, then file appears in added", () => {
  // Given
  const diskFiles = [{ path: "src/new.ts", contentHashDigest: "abc123" }];
  const dbFiles: { filePath: string; contentDigest: string }[] = [];

  // When
  const result = diffFiles(diskFiles, dbFiles);

  // Then
  expect(result.added).toEqual(["src/new.ts"]);
  expect(result.modified).toEqual([]);
  expect(result.deleted).toEqual([]);
  expect(result.unchanged).toEqual([]);
});

test("diffFiles: given a file in db not on disk, when diffed, then file appears in deleted", () => {
  // Given
  const diskFiles: { path: string; contentHashDigest: string }[] = [];
  const dbFiles = [{ filePath: "src/old.ts", contentDigest: "abc123" }];

  // When
  const result = diffFiles(diskFiles, dbFiles);

  // Then
  expect(result.deleted).toEqual(["src/old.ts"]);
  expect(result.added).toEqual([]);
  expect(result.modified).toEqual([]);
  expect(result.unchanged).toEqual([]);
});

test("diffFiles: given a file with same hash in both, when diffed, then file appears in unchanged", () => {
  // Given
  const diskFiles = [{ path: "src/stable.ts", contentHashDigest: "same" }];
  const dbFiles = [{ filePath: "src/stable.ts", contentDigest: "same" }];

  // When
  const result = diffFiles(diskFiles, dbFiles);

  // Then
  expect(result.unchanged).toEqual(["src/stable.ts"]);
  expect(result.added).toEqual([]);
  expect(result.modified).toEqual([]);
  expect(result.deleted).toEqual([]);
});

test("diffFiles: given a file with different hash, when diffed, then file appears in modified", () => {
  // Given
  const diskFiles = [{ path: "src/changed.ts", contentHashDigest: "new" }];
  const dbFiles = [{ filePath: "src/changed.ts", contentDigest: "old" }];

  // When
  const result = diffFiles(diskFiles, dbFiles);

  // Then
  expect(result.modified).toEqual(["src/changed.ts"]);
  expect(result.added).toEqual([]);
  expect(result.deleted).toEqual([]);
  expect(result.unchanged).toEqual([]);
});

test("diffFiles: given empty disk and empty db, when diffed, then all arrays are empty", () => {
  // Given
  const diskFiles: { path: string; contentHashDigest: string }[] = [];
  const dbFiles: { filePath: string; contentDigest: string }[] = [];

  // When
  const result = diffFiles(diskFiles, dbFiles);

  // Then
  expect(result.added).toEqual([]);
  expect(result.modified).toEqual([]);
  expect(result.deleted).toEqual([]);
  expect(result.unchanged).toEqual([]);
});

test("diffFiles: given multiple files in mixed states, when diffed, then categorizes each correctly", () => {
  // Given
  const diskFiles = [
    { path: "src/new.ts", contentHashDigest: "aaa" },
    { path: "src/changed.ts", contentHashDigest: "bbb_new" },
    { path: "src/stable.ts", contentHashDigest: "ccc" },
  ];
  const dbFiles = [
    { filePath: "src/changed.ts", contentDigest: "bbb_old" },
    { filePath: "src/stable.ts", contentDigest: "ccc" },
    { filePath: "src/removed.ts", contentDigest: "ddd" },
  ];

  // When
  const result = diffFiles(diskFiles, dbFiles);

  // Then
  expect(result.added).toEqual(["src/new.ts"]);
  expect(result.modified).toEqual(["src/changed.ts"]);
  expect(result.unchanged).toEqual(["src/stable.ts"]);
  expect(result.deleted).toEqual(["src/removed.ts"]);
});

test("diffFiles: given empty disk and populated db, when diffed, then all db files appear in deleted", () => {
  // Given
  const diskFiles: { path: string; contentHashDigest: string }[] = [];
  const dbFiles = [
    { filePath: "src/a.ts", contentDigest: "aaa" },
    { filePath: "src/b.ts", contentDigest: "bbb" },
  ];

  // When
  const result = diffFiles(diskFiles, dbFiles);

  // Then
  expect(result.deleted).toEqual(["src/a.ts", "src/b.ts"]);
  expect(result.added).toEqual([]);
  expect(result.modified).toEqual([]);
  expect(result.unchanged).toEqual([]);
});
