import { test, expect, mock, beforeEach } from "bun:test";
import { typescriptChunker } from "./chunker/typescript";

// Mock the client module to avoid hitting external services
const mockAdd = mock(() => Promise.resolve());
const mockDelete = mock(() => Promise.resolve());
const mockCollection = {
  add: mockAdd,
  delete: mockDelete,
};

mock.module("../client", () => ({
  client: {
    chromadb: {
      getOrCreateCollection: mock(() => Promise.resolve(mockCollection)),
    },
    voyageai: {
      embed: mock(() =>
        Promise.resolve({
          data: [
            { embedding: [0.1, 0.2] },
            { embedding: [0.3, 0.4] },
            { embedding: [0.5, 0.6] },
            { embedding: [0.7, 0.8] },
            { embedding: [0.9, 1.0] },
          ],
        }),
      ),
    },
  },
}));

// Import after mocking
const { codeMemory } = await import("./code");

beforeEach(() => {
  mockAdd.mockClear();
  mockDelete.mockClear();
});

test("writeOne returns chunk IDs matching chunker output", async () => {
  const code = `
import { foo } from "bar";

function hello() {
  return "world";
}

const x = 42;
`;
  const chunks = typescriptChunker.chunkCode(code, "test.ts");
  const ids = await codeMemory.writeOne({ code, filePath: "test.ts" });

  expect(ids).toBeArrayOfSize(chunks.length);
  for (const id of ids) {
    expect(id).toStartWith("test.ts#");
  }
});

test("writeOne returns IDs in format filePath#symbolName", async () => {
  const code = `function greet() { return "hi"; }`;
  const ids = await codeMemory.writeOne({ code, filePath: "src/greet.ts" });

  expect(ids).toContain("src/greet.ts#greet");
});

test("deleteChunks with empty array is a no-op", async () => {
  await codeMemory.deleteChunks([]);
  expect(mockDelete).not.toHaveBeenCalled();
});

test("deleteChunks calls collection.delete with ids", async () => {
  await codeMemory.deleteChunks(["a#foo", "a#bar"]);
  expect(mockDelete).toHaveBeenCalledWith({ ids: ["a#foo", "a#bar"] });
});
