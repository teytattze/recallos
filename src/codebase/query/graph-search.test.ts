import { test, expect, mock } from "bun:test";

const mockWhere = mock(() => Promise.resolve([{ id: "file-a" }]));
const mockFrom = mock(() => ({ where: mockWhere }));
const mockSelect = mock(() => ({ from: mockFrom }));
const mockExecute = mock(
  () =>
    Promise.resolve([] as { file_path: string; relationship: string; source_file_path: string }[]),
);

// oxlint-disable-next-line typescript/no-floating-promises
mock.module("@/db/db", () => ({
  db: { select: mockSelect, execute: mockExecute },
}));

const { findRelatedFilesByCodebaseId } = await import(
  "@/codebase/query/graph-search"
);

test("findRelatedFilesByCodebaseId: given depth=0, returns empty array", async () => {
  mockWhere.mockImplementationOnce(() =>
    Promise.resolve([{ id: "file-a" }]),
  );
  // depth=0 causes getRelatedFiles to return early — db.execute is never called

  const result = await findRelatedFilesByCodebaseId("cb-1", ["a.ts"], 0);
  expect(result.relatedFiles).toEqual([]);
});

test("findRelatedFilesByCodebaseId: given depth=1, returns direct neighbors in both directions", async () => {
  mockWhere.mockImplementationOnce(() =>
    Promise.resolve([{ id: "file-b" }]),
  );
  mockExecute.mockImplementationOnce(() =>
    Promise.resolve([
      {
        file_path: "a.ts",
        relationship: "references" as const,
        source_file_path: "b.ts",
      },
      {
        file_path: "c.ts",
        relationship: "referencedBy" as const,
        source_file_path: "b.ts",
      },
    ]),
  );

  const result = await findRelatedFilesByCodebaseId("cb-1", ["b.ts"], 1);

  const filePaths = result.relatedFiles.map((r) => r.filePath).sort();
  expect(filePaths).toEqual(["a.ts", "c.ts"]);

  const refToA = result.relatedFiles.find((r) => r.filePath === "a.ts");
  expect(refToA?.relationship).toBe("references");
  expect(refToA?.sourceFilePath).toBe("b.ts");

  const refToC = result.relatedFiles.find((r) => r.filePath === "c.ts");
  expect(refToC?.relationship).toBe("referencedBy");
  expect(refToC?.sourceFilePath).toBe("b.ts");
});

test("findRelatedFilesByCodebaseId: given depth=2, returns transitive neighbors", async () => {
  mockWhere.mockImplementationOnce(() =>
    Promise.resolve([{ id: "file-a" }]),
  );
  mockExecute.mockImplementationOnce(() =>
    Promise.resolve([
      {
        file_path: "b.ts",
        relationship: "referencedBy" as const,
        source_file_path: "a.ts",
      },
      {
        file_path: "c.ts",
        relationship: "referencedBy" as const,
        source_file_path: "b.ts",
      },
      {
        file_path: "d.ts",
        relationship: "references" as const,
        source_file_path: "a.ts",
      },
    ]),
  );

  const result = await findRelatedFilesByCodebaseId("cb-1", ["a.ts"], 2);

  const filePaths = result.relatedFiles.map((r) => r.filePath).sort();
  expect(filePaths).toContain("b.ts");
  expect(filePaths).toContain("c.ts");
  expect(filePaths).toContain("d.ts");
});

test("findRelatedFilesByCodebaseId: given seed files, they are excluded from results", async () => {
  mockWhere.mockImplementationOnce(() =>
    Promise.resolve([{ id: "file-a" }, { id: "file-b" }]),
  );
  mockExecute.mockImplementationOnce(() =>
    Promise.resolve([
      {
        file_path: "c.ts",
        relationship: "referencedBy" as const,
        source_file_path: "b.ts",
      },
    ]),
  );

  const result = await findRelatedFilesByCodebaseId(
    "cb-1",
    ["a.ts", "b.ts"],
    1,
  );

  const filePaths = result.relatedFiles.map((r) => r.filePath);
  expect(filePaths).not.toContain("a.ts");
  expect(filePaths).not.toContain("b.ts");
});

test("findRelatedFilesByCodebaseId: given empty seed, returns empty array", async () => {
  mockWhere.mockImplementationOnce(() => Promise.resolve([]));

  const result = await findRelatedFilesByCodebaseId("cb-1", [], 1);
  expect(result.relatedFiles).toEqual([]);
});
