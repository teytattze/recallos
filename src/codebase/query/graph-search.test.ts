import { test, expect, beforeAll, afterAll } from "bun:test";
import { db } from "@/db/db";
import { codebase, codebaseFile, graphEdge } from "@/db/schema";
import { newBaseFieldsValue } from "@/db/util";
import { findRelatedFilesByCodebaseId } from "@/codebase/query/graph-search";
import { eq } from "drizzle-orm";

const TEST_PREFIX = "__test_query_";

type TestFile = { id: string; filePath: string };

let testCodebaseId: string;

async function createTestFile(filePath: string): Promise<TestFile> {
  const base = newBaseFieldsValue();
  await db.insert(codebaseFile).values({
    ...base,
    filePath,
    content: "",
    contentHashDigest: "test",
    status: "complete",
    codebaseId: testCodebaseId,
  });
  return { id: base.id, filePath };
}

async function createTestEdge(fromId: string, toId: string) {
  await db.insert(graphEdge).values({
    ...newBaseFieldsValue(),
    relationship: "references",
    fromId,
    toId,
  });
}

let fileA: TestFile;
let fileB: TestFile;
let fileC: TestFile;
let fileD: TestFile;

beforeAll(async () => {
  // Create test codebase
  const cbBase = newBaseFieldsValue();
  testCodebaseId = cbBase.id;
  await db.insert(codebase).values({
    ...cbBase,
    name: `${TEST_PREFIX}codebase`,
  });

  // Create test files: A -> B -> C, D -> A
  fileA = await createTestFile(`${TEST_PREFIX}a.ts`);
  fileB = await createTestFile(`${TEST_PREFIX}b.ts`);
  fileC = await createTestFile(`${TEST_PREFIX}c.ts`);
  fileD = await createTestFile(`${TEST_PREFIX}d.ts`);

  // A references B (A imports B)
  await createTestEdge(fileA.id, fileB.id);
  // B references C (B imports C)
  await createTestEdge(fileB.id, fileC.id);
  // D references A (D imports A)
  await createTestEdge(fileD.id, fileA.id);
});

afterAll(async () => {
  // Clean up edges first (FK constraints)
  for (const file of [fileA, fileB, fileC, fileD]) {
    await db.delete(graphEdge).where(eq(graphEdge.fromId, file.id));
    await db.delete(graphEdge).where(eq(graphEdge.toId, file.id));
  }
  for (const file of [fileA, fileB, fileC, fileD]) {
    await db.delete(codebaseFile).where(eq(codebaseFile.id, file.id));
  }
  await db.delete(codebase).where(eq(codebase.id, testCodebaseId));
});

test("findRelatedFilesByCodebaseId: depth=0 returns empty array", async () => {
  const result = await findRelatedFilesByCodebaseId(
    testCodebaseId,
    [fileA.filePath],
    0,
  );
  expect(result.relatedFiles).toEqual([]);
});

test("findRelatedFilesByCodebaseId: depth=1 returns direct neighbors in both directions", async () => {
  // Seed on B: A references B (so A is a "references" neighbor), B references C (so C is a "referencedBy" neighbor)
  const result = await findRelatedFilesByCodebaseId(
    testCodebaseId,
    [fileB.filePath],
    1,
  );

  const filePaths = result.relatedFiles.map((r) => r.filePath).sort();
  expect(filePaths).toEqual([fileA.filePath, fileC.filePath].sort());

  const refToA = result.relatedFiles.find((r) => r.filePath === fileA.filePath);
  expect(refToA?.relationship).toBe("references");
  expect(refToA?.sourceFilePath).toBe(fileB.filePath);

  const refToC = result.relatedFiles.find((r) => r.filePath === fileC.filePath);
  expect(refToC?.relationship).toBe("referencedBy");
  expect(refToC?.sourceFilePath).toBe(fileB.filePath);
});

test("findRelatedFilesByCodebaseId: depth=2 returns transitive neighbors", async () => {
  // Seed on A: A references B (direct), B references C (transitive)
  // Also D references A, so D is direct referencedBy — but A is the seed so excluded
  const result = await findRelatedFilesByCodebaseId(
    testCodebaseId,
    [fileA.filePath],
    2,
  );

  const filePaths = result.relatedFiles.map((r) => r.filePath).sort();
  expect(filePaths).toContain(fileB.filePath);
  expect(filePaths).toContain(fileC.filePath);
  expect(filePaths).toContain(fileD.filePath);
});

test("findRelatedFilesByCodebaseId: seed files are excluded from results", async () => {
  // Seed on both A and B — neither should appear in results
  const result = await findRelatedFilesByCodebaseId(
    testCodebaseId,
    [fileA.filePath, fileB.filePath],
    1,
  );

  const filePaths = result.relatedFiles.map((r) => r.filePath);
  expect(filePaths).not.toContain(fileA.filePath);
  expect(filePaths).not.toContain(fileB.filePath);
});

test("findRelatedFilesByCodebaseId: empty seed returns empty array", async () => {
  const result = await findRelatedFilesByCodebaseId(testCodebaseId, [], 1);
  expect(result.relatedFiles).toEqual([]);
});
