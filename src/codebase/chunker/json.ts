import { registerDynamicLanguage, parse } from "@ast-grep/napi";
import json from "@ast-grep/lang-json";
import { deduplicateName, wholeFileChunk } from "@/codebase/chunker/util";
import type { Chunk } from "@/codebase/chunker/types";

registerDynamicLanguage({ json });

function unquote(text: string): string {
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  return text;
}

function chunkCode(content: string, filePath: string): Chunk[] {
  const root = parse("json", content).root();
  const chunks: Chunk[] = [];

  // Find the root value node (first named child of document)
  const rootValue = root.children().find((c) => c.isNamed());

  if (!rootValue) {
    return [];
  }

  if (rootValue.kind() === "object") {
    const nameCount = new Map<string, number>();

    for (const child of rootValue.children()) {
      if (child.kind() !== "pair") continue;

      const keyNode = child.field("key");
      if (!keyNode) continue;

      const keyText = unquote(keyNode.text());
      const finalName = deduplicateName(nameCount, keyText);

      const range = child.range();
      chunks.push({
        content: content.slice(range.start.index, range.end.index),
        symbolName: finalName,
        symbolKind: "property",
        filePath,
        startLine: range.start.line + 1,
        endLine: range.end.line + 1,
      });
    }
  }

  if (chunks.length === 0 && content.trim().length > 0) {
    chunks.push(wholeFileChunk(content, filePath));
  }

  return chunks;
}

const jsonChunker = { chunkCode };

export { jsonChunker };
