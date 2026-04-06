import type { Chunk } from "@/memory/chunker/types";

function chunkMarkdown(_content: string, _filePath: string): Chunk[] {
  throw new Error("Markdown chunker not implemented");
}

const markdownChunker = { chunkMarkdown };

export { markdownChunker };
