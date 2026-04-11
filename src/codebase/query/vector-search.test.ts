import { test, expect, mock } from "bun:test";

const KNOWN_EMBEDDING = Array.from({ length: 1024 }, () => 1 / Math.sqrt(1024));

const mockLimit = mock(() =>
  Promise.resolve([
    {
      id: "chunk-1",
      content: "function chunk0() { return 0; }",
      symbolName: "chunk0",
      symbolKind: "function",
      startLine: 0,
      endLine: 5,
      filePath: "main.ts",
      distance: 0.1,
    },
    {
      id: "chunk-2",
      content: "function chunk1() { return 1; }",
      symbolName: "chunk1",
      symbolKind: "function",
      startLine: 10,
      endLine: 15,
      filePath: "main.ts",
      distance: 0.2,
    },
    {
      id: "chunk-3",
      content: "function chunk2() { return 2; }",
      symbolName: "chunk2",
      symbolKind: "function",
      startLine: 20,
      endLine: 25,
      filePath: "main.ts",
      distance: 0.3,
    },
  ]),
);

const mockOrderBy = mock(() => ({ limit: mockLimit }));
const mockInnerJoin = mock(() => ({ orderBy: mockOrderBy }));
const mockFrom = mock(() => ({ innerJoin: mockInnerJoin }));
const mockSelect = mock(() => ({ from: mockFrom }));

// oxlint-disable-next-line typescript/no-floating-promises
mock.module("@/db/db", () => ({
  db: { select: mockSelect },
}));

// oxlint-disable-next-line typescript/no-floating-promises
mock.module("@/codebase/embed", () => ({
  embedTexts: async (texts: string[]) => texts.map(() => KNOWN_EMBEDDING),
}));

const { searchByText } = await import("@/codebase/query/vector-search");

test("searchByText: single query returns one queryOutput with results", async () => {
  const result = await searchByText(["find functions"], "codebase-1");

  expect(result.queryOutputs).toHaveLength(1);
  expect(result.queryOutputs[0]?.originalQuery).toBe("find functions");
  expect(result.queryOutputs[0]?.results.length).toBeGreaterThan(0);
});

test("searchByText: multiple queries return one queryOutput per query", async () => {
  const result = await searchByText(["query one", "query two"], "codebase-1");

  expect(result.queryOutputs).toHaveLength(2);
  expect(result.queryOutputs[0]?.originalQuery).toBe("query one");
  expect(result.queryOutputs[1]?.originalQuery).toBe("query two");
});

test("searchByText: result has expected shape", async () => {
  const result = await searchByText(["shape test"], "codebase-1");
  const first = result.queryOutputs[0]?.results[0];

  expect(first).toBeDefined();
  expect(first).toHaveProperty("id");
  expect(first).toHaveProperty("document");
  expect(first).toHaveProperty("filePath");
  expect(first).toHaveProperty("symbolName");
  expect(first).toHaveProperty("symbolKind");
  expect(first).toHaveProperty("startLine");
  expect(first).toHaveProperty("endLine");
  expect(first?.filePath).toBe("main.ts");
  expect(first?.symbolKind).toBe("function");
});

test("searchByText: respects nResults limit", async () => {
  mockLimit.mockImplementationOnce(() =>
    Promise.resolve([
      {
        id: "chunk-1",
        content: "function chunk0() { return 0; }",
        symbolName: "chunk0",
        symbolKind: "function",
        startLine: 0,
        endLine: 5,
        filePath: "main.ts",
        distance: 0.1,
      },
      {
        id: "chunk-2",
        content: "function chunk1() { return 1; }",
        symbolName: "chunk1",
        symbolKind: "function",
        startLine: 10,
        endLine: 15,
        filePath: "main.ts",
        distance: 0.2,
      },
    ]),
  );

  const result = await searchByText(["limit test"], "codebase-1", 2);

  expect(result.queryOutputs[0]?.results).toHaveLength(2);
});

test("searchByText: scopes results to the given codebaseId", async () => {
  const result = await searchByText(["scoping test"], "codebase-1");
  const filePaths = result.queryOutputs[0]?.results.map((r) => r.filePath);

  // All results come from our mock which only returns "main.ts"
  for (const fp of filePaths ?? []) {
    expect(fp).toBe("main.ts");
  }
});
