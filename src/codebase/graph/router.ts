import type { Chunk } from "@/codebase/chunker/types";
import type { GraphAdapter, RawReference } from "@/codebase/graph/types";
import { extractWithAdapter } from "@/codebase/graph/generic";
import { typescriptGraphAdapter } from "@/codebase/graph/adapters/typescript";

const ADAPTERS: GraphAdapter[] = [typescriptGraphAdapter];

const EXTENSION_MAP = new Map<string, GraphAdapter>();
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

function extractReferences(
  content: string,
  filePath: string,
  chunks: Chunk[],
): RawReference[] {
  const ext = getExtension(filePath);
  const adapter = EXTENSION_MAP.get(ext);

  if (!adapter) return [];

  return extractWithAdapter(content, filePath, chunks, adapter);
}

export { extractReferences };
