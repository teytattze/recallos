import type { Chunk } from "@/codebase/chunker/types";
import { wholeFileChunk } from "@/codebase/chunker/util";
import { typescriptChunker } from "@/codebase/chunker/typescript";
import { markdownChunker } from "@/codebase/chunker/markdown";
import { jsonChunker } from "@/codebase/chunker/json";

const EXTENSION_MAP: Record<
  string,
  (content: string, filePath: string) => Chunk[]
> = {
  ".ts": typescriptChunker.chunkCode,
  ".tsx": typescriptChunker.chunkCode,
  ".md": markdownChunker.chunkCode,
  ".mdx": markdownChunker.chunkCode,
  ".json": jsonChunker.chunkCode,
};

function getExtension(filePath: string): string {
  const basename = filePath.split("/").pop() ?? filePath;
  const dot = basename.lastIndexOf(".");
  return dot === -1 ? "" : basename.slice(dot);
}

function chunkFile(content: string, filePath: string): Chunk[] {
  const ext = getExtension(filePath);
  const chunker = EXTENSION_MAP[ext];

  if (chunker) {
    return chunker(content, filePath);
  }

  if (content.trim().length === 0) return [];
  return [wholeFileChunk(content, filePath)];
}

export { chunkFile, getExtension };
