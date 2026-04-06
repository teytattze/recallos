import { test, expect, describe } from "bun:test";
import { jsonChunker } from "@/memory/chunker/json";

describe("jsonChunker", () => {
  test("extracts top-level object keys", async () => {
    const content = `{
  "name": "recallos",
  "version": "1.0.0",
  "description": "A semantic code memory system"
}`;

    const chunks = await jsonChunker.chunkCode(content, "package.json");
    expect(chunks).toHaveLength(3);
    expect(chunks[0]!.symbolName).toBe("name");
    expect(chunks[0]!.symbolKind).toBe("property");
    expect(chunks[0]!.content).toContain('"recallos"');
    expect(chunks[1]!.symbolName).toBe("version");
    expect(chunks[2]!.symbolName).toBe("description");
  });

  test("handles nested objects as single chunks", async () => {
    const content = `{
  "scripts": {
    "build": "bun build",
    "test": "bun test"
  },
  "dependencies": {
    "hono": "^4.0.0"
  }
}`;

    const chunks = await jsonChunker.chunkCode(content, "package.json");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.symbolName).toBe("scripts");
    expect(chunks[0]!.content).toContain('"build"');
    expect(chunks[0]!.content).toContain('"test"');
    expect(chunks[1]!.symbolName).toBe("dependencies");
  });

  test("array root falls back to whole file", async () => {
    const content = `[1, 2, 3]`;

    const chunks = await jsonChunker.chunkCode(content, "data.json");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.symbolKind).toBe("file");
    expect(chunks[0]!.symbolName).toBe("data.json");
  });

  test("primitive root falls back to whole file", async () => {
    const content = `"hello"`;

    const chunks = await jsonChunker.chunkCode(content, "value.json");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.symbolKind).toBe("file");
    expect(chunks[0]!.symbolName).toBe("value.json");
  });

  test("handles empty object", async () => {
    const content = `{}`;

    const chunks = await jsonChunker.chunkCode(content, "empty.json");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.symbolKind).toBe("file");
    expect(chunks[0]!.symbolName).toBe("empty.json");
  });

  test("handles empty file", async () => {
    const chunks = await jsonChunker.chunkCode("", "empty.json");
    expect(chunks).toHaveLength(0);
  });

  test("sets correct line numbers", async () => {
    const content = `{
  "first": 1,
  "second": {
    "nested": true
  }
}`;

    const chunks = await jsonChunker.chunkCode(content, "test.json");
    expect(chunks[0]!.startLine).toBe(2);
    expect(chunks[0]!.endLine).toBe(2);
    expect(chunks[1]!.symbolName).toBe("second");
    expect(chunks[1]!.startLine).toBe(3);
    expect(chunks[1]!.endLine).toBe(5);
  });

  test("sets filePath on all chunks", async () => {
    const content = `{"key": "value"}`;

    const chunks = await jsonChunker.chunkCode(content, "path/to/config.json");
    for (const chunk of chunks) {
      expect(chunk.filePath).toBe("path/to/config.json");
    }
  });

  test("handles duplicate keys", async () => {
    const content = `{
  "key": 1,
  "key": 2
}`;

    const chunks = await jsonChunker.chunkCode(content, "dup.json");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.symbolName).toBe("key");
    expect(chunks[1]!.symbolName).toBe("key_2");
  });

  test("handles array of objects at root", async () => {
    const content = `[
  {"name": "a"},
  {"name": "b"}
]`;

    const chunks = await jsonChunker.chunkCode(content, "items.json");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.symbolKind).toBe("file");
  });
});
