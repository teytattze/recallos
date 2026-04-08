import { test, expect, describe } from "bun:test";
import { typescriptChunker } from "@/codebase/chunker/typescript";

describe("typescriptChunker", () => {
  test("extracts preamble from imports and top comments", () => {
    const code = `// Top comment
import { foo } from "bar";
import { baz } from "qux";

const x = 1;`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const preamble = chunks.find((c) => c.symbolName === "_preamble");
    expect(preamble).toBeDefined();
    expect(preamble!.symbolKind).toBe("preamble");
    expect(preamble!.content).toContain("// Top comment");
    expect(preamble!.content).toContain('import { foo } from "bar"');
    expect(preamble!.content).toContain('import { baz } from "qux"');
  });

  test("extracts function declaration", () => {
    const code = `function greet(name: string) {
  return "hello " + name;
}`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const fn = chunks.find((c) => c.symbolName === "greet");
    expect(fn).toBeDefined();
    expect(fn!.symbolKind).toBe("function");
    expect(fn!.content).toContain("function greet");
    expect(fn!.startLine).toBe(1);
    expect(fn!.endLine).toBe(3);
  });

  test("extracts arrow function in const", () => {
    const code = `const add = (a: number, b: number) => a + b;`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const fn = chunks.find((c) => c.symbolName === "add");
    expect(fn).toBeDefined();
    expect(fn!.symbolKind).toBe("variable");
    expect(fn!.content).toContain("const add");
  });

  test("extracts class declaration", () => {
    const code = `class MyClass {
  constructor() {}
  method() { return 1; }
}`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const cls = chunks.find((c) => c.symbolName === "MyClass");
    expect(cls).toBeDefined();
    expect(cls!.symbolKind).toBe("class");
    expect(cls!.content).toContain("class MyClass");
  });

  test("extracts interface declaration", () => {
    const code = `interface User {
  name: string;
  age: number;
}`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const iface = chunks.find((c) => c.symbolName === "User");
    expect(iface).toBeDefined();
    expect(iface!.symbolKind).toBe("interface");
  });

  test("extracts type alias", () => {
    const code = `type Point = { x: number; y: number };`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const t = chunks.find((c) => c.symbolName === "Point");
    expect(t).toBeDefined();
    expect(t!.symbolKind).toBe("type");
  });

  test("extracts enum declaration", () => {
    const code = `enum Status {
  Active,
  Inactive,
}`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const e = chunks.find((c) => c.symbolName === "Status");
    expect(e).toBeDefined();
    expect(e!.symbolKind).toBe("enum");
  });

  test("unwraps export statement", () => {
    const code = `export function greet() { return "hi"; }`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const fn = chunks.find((c) => c.symbolName === "greet");
    expect(fn).toBeDefined();
    expect(fn!.symbolKind).toBe("function");
    expect(fn!.content).toContain("export function greet");
  });

  test("attaches leading JSDoc to symbol", () => {
    const code = `/** Adds two numbers */
function add(a: number, b: number) {
  return a + b;
}`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const fn = chunks.find((c) => c.symbolName === "add");
    expect(fn).toBeDefined();
    expect(fn!.content).toContain("/** Adds two numbers */");
    expect(fn!.content).toContain("function add");
    expect(fn!.startLine).toBe(1);
  });

  test("does not attach comment separated by blank line", () => {
    const code = `// Unrelated comment

function foo() {}`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const fn = chunks.find((c) => c.symbolName === "foo");
    expect(fn).toBeDefined();
    expect(fn!.content).not.toContain("// Unrelated comment");
  });

  test("no content is lost between chunks", () => {
    const code = `import { x } from "y";

type Foo = { a: number };

const bar = 42;

function baz() { return bar; }`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    // Every non-whitespace character in the source should appear in some chunk
    const allChunkContent = chunks.map((c) => c.content).join("");
    const sourceNonWs = code.replace(/\s+/g, "");
    const chunksNonWs = allChunkContent.replace(/\s+/g, "");
    expect(chunksNonWs).toBe(sourceNonWs);
  });

  test("falls back to single chunk for empty file", () => {
    const code = ``;
    const chunks = typescriptChunker.chunkCode(code, "empty.ts");
    expect(chunks.length).toBe(0);
  });

  test("falls back to single chunk for file with only whitespace", () => {
    const code = `   \n\n   `;
    const chunks = typescriptChunker.chunkCode(code, "blank.ts");
    expect(chunks.length).toBe(0);
  });

  test("falls back to single chunk for file with only comments", () => {
    const code = `// just a comment
// another comment`;

    const chunks = typescriptChunker.chunkCode(code, "comments.ts");
    // Comments-only file: preamble captures them
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.symbolKind).toBe("preamble");
  });

  test("handles duplicate symbol names", () => {
    const code = `const foo = 1;
const foo = 2;`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const names = chunks.map((c) => c.symbolName);
    expect(names).toContain("foo");
    expect(names).toContain("foo_2");
  });

  test("parses actual codebase/query.ts file", async () => {
    const content = await Bun.file("src/codebase/query.ts").text();
    const chunks = typescriptChunker.chunkCode(
      content,
      "src/codebase/query.ts",
    );

    expect(chunks.length).toBeGreaterThan(0);

    // Should have a preamble with imports
    const preamble = chunks.find((c) => c.symbolKind === "preamble");
    expect(preamble).toBeDefined();

    // Should have recognizable symbols
    const names = chunks.map((c) => c.symbolName);
    expect(names).toContain("readInputSchema");
    expect(names).toContain("searchCodebase");

    // Every chunk should have valid metadata
    for (const chunk of chunks) {
      expect(chunk.filePath).toBe("src/codebase/query.ts");
      expect(chunk.startLine).toBeGreaterThan(0);
      expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  test("handles export default", () => {
    const code = `export default function main() {}`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    // The export wraps a function declaration — should unwrap it
    const fn = chunks.find((c) => c.symbolName === "main");
    expect(fn).toBeDefined();
    expect(fn!.symbolKind).toBe("function");
  });

  test("handles bare export statement", () => {
    const code = `const x = 1;
export { x };`;

    const chunks = typescriptChunker.chunkCode(code, "test.ts");
    const exportChunk = chunks.find((c) => c.symbolKind === "export");
    expect(exportChunk).toBeDefined();
    expect(exportChunk!.content).toContain("export { x }");
  });
});
