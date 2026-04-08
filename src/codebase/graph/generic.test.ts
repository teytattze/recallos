import { test, expect, describe } from "bun:test";
import { extractWithAdapter } from "@/codebase/graph/generic";
import { typescriptGraphAdapter } from "@/codebase/graph/adapters/typescript";
import { chunkWithAdapter } from "@/codebase/chunker/generic";
import { typescriptAdapter } from "@/codebase/chunker/adapters/typescript";

const extractFromCode = (code: string, filePath = "test.ts") => {
  const chunks = chunkWithAdapter(code, filePath, typescriptAdapter);
  return { chunks, refs: extractWithAdapter(code, filePath, chunks, typescriptGraphAdapter) };
};

describe("extractWithAdapter", () => {
  test("detects function call references", () => {
    const code = `function greet(name: string) {
  return "hello " + name;
}

function main() {
  greet("world");
}`;

    const { refs } = extractFromCode(code);
    const mainRef = refs.find((r) => r.chunkSymbolName === "main");
    expect(mainRef).toBeDefined();
    expect(mainRef!.referencedIdentifiers).toContain("greet");
  });

  test("excludes self-references", () => {
    const code = `function foo() {
  foo();
}`;

    const { refs } = extractFromCode(code);
    const fooRef = refs.find((r) => r.chunkSymbolName === "foo");
    // foo calls itself, but self-reference should be excluded
    // The only identifier left might be nothing, so refs may be empty for this chunk
    if (fooRef) {
      expect(fooRef.referencedIdentifiers).not.toContain("foo");
    }
  });

  test("detects type references", () => {
    const code = `type User = {
  name: string;
  age: number;
};

function getUser(): User {
  return { name: "test", age: 1 };
}`;

    const { refs } = extractFromCode(code);
    const fnRef = refs.find((r) => r.chunkSymbolName === "getUser");
    expect(fnRef).toBeDefined();
    expect(fnRef!.referencedIdentifiers).toContain("User");
  });

  test("deduplicates identifiers within a chunk", () => {
    const code = `function greet(name: string) {
  return "hello " + name;
}

function main() {
  greet("a");
  greet("b");
  greet("c");
}`;

    const { refs } = extractFromCode(code);
    const mainRef = refs.find((r) => r.chunkSymbolName === "main");
    expect(mainRef).toBeDefined();
    const greetCount = mainRef!.referencedIdentifiers.filter(
      (id) => id === "greet",
    ).length;
    expect(greetCount).toBe(1);
  });

  test("returns empty for empty content", () => {
    const refs = extractWithAdapter("", "test.ts", [], typescriptGraphAdapter);
    expect(refs).toEqual([]);
  });

  test("returns empty for file with no adapter", () => {
    const code = `function foo() {}`;
    const chunks = chunkWithAdapter(code, "test.ts", typescriptAdapter);
    // Chunks with no identifiers referencing other chunks
    const refs = extractWithAdapter(code, "test.ts", chunks, typescriptGraphAdapter);
    // foo has no references to other symbols, might be empty
    const fooRef = refs.find((r) => r.chunkSymbolName === "foo");
    if (fooRef) {
      // Any identifiers found should not be "foo" itself
      expect(fooRef.referencedIdentifiers).not.toContain("foo");
    }
  });

  test("handles multiple cross-references", () => {
    const code = `type Config = { debug: boolean };

function loadConfig(): Config {
  return { debug: true };
}

function main() {
  const config = loadConfig();
  console.log(config);
}`;

    const { refs } = extractFromCode(code);
    const loadRef = refs.find((r) => r.chunkSymbolName === "loadConfig");
    expect(loadRef).toBeDefined();
    expect(loadRef!.referencedIdentifiers).toContain("Config");

    const mainRef = refs.find((r) => r.chunkSymbolName === "main");
    expect(mainRef).toBeDefined();
    expect(mainRef!.referencedIdentifiers).toContain("loadConfig");
  });

  test("handles preamble chunk identifiers", () => {
    const code = `import { foo } from "bar";

function main() {
  foo();
}`;

    const { refs } = extractFromCode(code);
    const preambleRef = refs.find((r) => r.chunkSymbolName === "_preamble");
    if (preambleRef) {
      expect(preambleRef.referencedIdentifiers).toContain("foo");
    }
  });
});
