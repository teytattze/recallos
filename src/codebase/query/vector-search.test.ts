import { test, expect, beforeAll, afterAll, mock } from "bun:test";
import { db } from "@/db/db";
import { codebase, codebaseChunk, codebaseFile } from "@/db/schema";
import { newBaseFieldsValue } from "@/db/util";
import { eq } from "drizzle-orm";

// Known embedding: normalized vector (all equal components)
const KNOWN_EMBEDDING = Array.from({ length: 1024 }, () => 1 / Math.sqrt(1024));

// Mock embedTexts to return the known embedding for every query
// oxlint-disable-next-line typescript/no-floating-promises
mock.module("@/codebase/embed", () => ({
  embedTexts: async (texts: string[]) => texts.map(() => KNOWN_EMBEDDING),
}));

// Import after mock so the mock is picked up
const { searchByText } = await import("@/codebase/query/vector-search");

const TEST_PREFIX = "__test_vsearch_";

let testCodebaseId: string;
let otherCodebaseId: string;
let testFileId: string;
let otherFileId: string;

beforeAll(async () => {
  // Create test codebase
  const cbBase = newBaseFieldsValue();
  testCodebaseId = cbBase.id;
  await db.insert(codebase).values({
    ...cbBase,
    name: `${TEST_PREFIX}codebase`,
  });

  // Create a second codebase (for scoping test)
  const otherCbBase = newBaseFieldsValue();
  otherCodebaseId = otherCbBase.id;
  await db.insert(codebase).values({
    ...otherCbBase,
    name: `${TEST_PREFIX}other_codebase`,
  });

  // Create test file in main codebase
  const fileBase = newBaseFieldsValue();
  testFileId = fileBase.id;
  await db.insert(codebaseFile).values({
    ...fileBase,
    filePath: `${TEST_PREFIX}main.ts`,
    content: "export function main() {}",
    contentHashDigest: "test",
    status: "complete",
    codebaseId: testCodebaseId,
  });

  // Create file in other codebase
  const otherFileBase = newBaseFieldsValue();
  otherFileId = otherFileBase.id;
  await db.insert(codebaseFile).values({
    ...otherFileBase,
    filePath: `${TEST_PREFIX}other.ts`,
    content: "export function other() {}",
    contentHashDigest: "test",
    status: "complete",
    codebaseId: otherCodebaseId,
  });

  // Insert 3 chunks in main codebase file (with known embedding)
  for (let i = 0; i < 3; i++) {
    await db.insert(codebaseChunk).values({
      ...newBaseFieldsValue(),
      content: `function chunk${i}() { return ${i}; }`,
      symbolName: `chunk${i}`,
      symbolKind: "function",
      startLine: i * 10,
      endLine: i * 10 + 5,
      embedding: KNOWN_EMBEDDING,
      fileId: testFileId,
    });
  }

  // Insert 1 chunk in other codebase file
  await db.insert(codebaseChunk).values({
    ...newBaseFieldsValue(),
    content: "function otherChunk() {}",
    symbolName: "otherChunk",
    symbolKind: "function",
    startLine: 0,
    endLine: 3,
    embedding: KNOWN_EMBEDDING,
    fileId: otherFileId,
  });
});

afterAll(async () => {
  // Clean up in dependency order: chunks -> files -> codebases
  await db.delete(codebaseChunk).where(eq(codebaseChunk.fileId, testFileId));
  await db.delete(codebaseChunk).where(eq(codebaseChunk.fileId, otherFileId));
  await db.delete(codebaseFile).where(eq(codebaseFile.id, testFileId));
  await db.delete(codebaseFile).where(eq(codebaseFile.id, otherFileId));
  await db.delete(codebase).where(eq(codebase.id, testCodebaseId));
  await db.delete(codebase).where(eq(codebase.id, otherCodebaseId));
});

test("searchByText: single query returns one queryOutput with results", async () => {
  const result = await searchByText(["find functions"], testCodebaseId);

  expect(result.queryOutputs).toHaveLength(1);
  expect(result.queryOutputs[0]?.originalQuery).toBe("find functions");
  expect(result.queryOutputs[0]?.results.length).toBeGreaterThan(0);
});

test("searchByText: multiple queries return one queryOutput per query", async () => {
  const result = await searchByText(["query one", "query two"], testCodebaseId);

  expect(result.queryOutputs).toHaveLength(2);
  expect(result.queryOutputs[0]?.originalQuery).toBe("query one");
  expect(result.queryOutputs[1]?.originalQuery).toBe("query two");
});

test("searchByText: result has expected shape", async () => {
  const result = await searchByText(["shape test"], testCodebaseId);
  const first = result.queryOutputs[0]?.results[0];

  expect(first).toBeDefined();
  expect(first).toHaveProperty("id");
  expect(first).toHaveProperty("document");
  expect(first).toHaveProperty("filePath");
  expect(first).toHaveProperty("symbolName");
  expect(first).toHaveProperty("symbolKind");
  expect(first).toHaveProperty("startLine");
  expect(first).toHaveProperty("endLine");
  expect(first?.filePath).toBe(`${TEST_PREFIX}main.ts`);
  expect(first?.symbolKind).toBe("function");
});

test("searchByText: respects nResults limit", async () => {
  const result = await searchByText(["limit test"], testCodebaseId, 2);

  expect(result.queryOutputs[0]?.results).toHaveLength(2);
});

test("searchByText: scopes results to the given codebaseId", async () => {
  const result = await searchByText(["scoping test"], testCodebaseId);
  const filePaths = result.queryOutputs[0]?.results.map((r) => r.filePath);

  expect(filePaths).not.toContain(`${TEST_PREFIX}other.ts`);
  for (const fp of filePaths ?? []) {
    expect(fp).toBe(`${TEST_PREFIX}main.ts`);
  }
});
