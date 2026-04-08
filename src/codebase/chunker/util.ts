import type { Chunk } from "@/codebase/chunker/types";

function deduplicateName(nameCount: Map<string, number>, name: string): string {
  const count = nameCount.get(name) ?? 0;
  nameCount.set(name, count + 1);
  return count > 0 ? `${name}_${count + 1}` : name;
}

function wholeFileChunk(content: string, filePath: string): Chunk {
  const basename = filePath.split("/").pop() ?? filePath;
  return {
    content,
    symbolName: basename,
    symbolKind: "file",
    filePath,
    startLine: 1,
    endLine: content.split("\n").length,
  };
}

export { deduplicateName, wholeFileChunk };
