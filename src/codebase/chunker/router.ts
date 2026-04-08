import type { Chunk, LanguageAdapter } from "@/codebase/chunker/types";
import { wholeFileChunk } from "@/codebase/chunker/util";
import { chunkWithAdapter } from "@/codebase/chunker/generic";
import { typescriptAdapter } from "@/codebase/chunker/adapters/typescript";
import { markdownAdapter } from "@/codebase/chunker/adapters/markdown";
import { jsonAdapter } from "@/codebase/chunker/adapters/json";

const ADAPTERS: LanguageAdapter[] = [
  typescriptAdapter,
  markdownAdapter,
  jsonAdapter,
];

const EXTENSION_MAP = new Map<string, LanguageAdapter>();
for (const adapter of ADAPTERS) {
  for (const ext of adapter.extensions) {
    EXTENSION_MAP.set(ext, adapter);
  }
}

function getExtension(filePath: string): string {
  const basename = filePath.split("/").pop() ?? filePath;
  const dot = basename.lastIndexOf(".");
  return dot === -1 ? "" : basename.slice(dot);
}

function chunkFile(content: string, filePath: string): Chunk[] {
  const ext = getExtension(filePath);
  const adapter = EXTENSION_MAP.get(ext);

  if (adapter) {
    return chunkWithAdapter(content, filePath, adapter);
  }

  if (content.trim().length === 0) return [];
  return [wholeFileChunk(content, filePath)];
}

export { chunkFile, getExtension };
