import { test, expect, describe } from "bun:test";
import { extractReferences } from "@/codebase/graph/router";
import { chunkWithAdapter } from "@/codebase/chunker/generic";
import { typescriptAdapter } from "@/codebase/chunker/adapters/typescript";

describe("extractReferences", () => {
  test("extracts references from TypeScript file", () => {
    const code = `function greet(name: string) {
  return "hello " + name;
}

function main() {
  greet("world");
}`;

    const chunks = chunkWithAdapter(code, "test.ts", typescriptAdapter);
    const refs = extractReferences(code, "test.ts", chunks);

    const mainRef = refs.find((r) => r.chunkSymbolName === "main");
    expect(mainRef).toBeDefined();
    expect(mainRef!.referencedIdentifiers).toContain("greet");
  });

  test("extracts references from .tsx file", () => {
    const code = `function Component() {
  return null;
}

function App() {
  return Component();
}`;

    const chunks = chunkWithAdapter(code, "app.tsx", typescriptAdapter);
    const refs = extractReferences(code, "app.tsx", chunks);

    const appRef = refs.find((r) => r.chunkSymbolName === "App");
    expect(appRef).toBeDefined();
    expect(appRef!.referencedIdentifiers).toContain("Component");
  });

  test("returns empty for unsupported file type", () => {
    const refs = extractReferences("some content", "test.py", []);
    expect(refs).toEqual([]);
  });

  test("returns empty for file with no extension", () => {
    const refs = extractReferences("some content", "Makefile", []);
    expect(refs).toEqual([]);
  });
});
