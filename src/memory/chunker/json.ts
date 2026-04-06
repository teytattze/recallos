import { Language, Parser } from "web-tree-sitter";
import type { Chunk } from "@/memory/chunker/types";
// @ts-expect-error -- Bun file embed, returns a path string
import parserWasmPath from "./wasm/web-tree-sitter.wasm" with { type: "file" };
// @ts-expect-error -- Bun file embed, returns a path string
import jsonWasmPath from "./wasm/tree-sitter-json.wasm" with { type: "file" };

let parser: Parser | null = null;

async function getParser(): Promise<Parser> {
  if (parser) return parser;
  await Parser.init({
    locateFile: () => parserWasmPath,
  });
  const p = new Parser();
  const lang = await Language.load(jsonWasmPath);
  p.setLanguage(lang);
  parser = p;
  return p;
}

function unquote(text: string): string {
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  return text;
}

async function chunkCode(content: string, filePath: string): Promise<Chunk[]> {
  const p = await getParser();
  const tree = p.parse(content);

  if (tree === null) return [];

  const rootNode = tree.rootNode;
  const chunks: Chunk[] = [];

  // Find the root value node (first named child of document)
  const rootValue = rootNode.children.find((c) => c.isNamed);

  if (!rootValue) {
    return [];
  }

  if (rootValue.type === "object") {
    const nameCount = new Map<string, number>();

    for (const child of rootValue.children) {
      if (child.type !== "pair") continue;

      const keyNode = child.childForFieldName("key");
      if (!keyNode) continue;

      const keyText = unquote(keyNode.text);

      const count = nameCount.get(keyText) ?? 0;
      nameCount.set(keyText, count + 1);
      const finalName = count > 0 ? `${keyText}_${count + 1}` : keyText;

      chunks.push({
        content: content.slice(child.startIndex, child.endIndex),
        symbolName: finalName,
        symbolKind: "property",
        filePath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
      });
    }
  }

  // Fallback: array, primitive, or object with no pairs → whole file
  if (chunks.length === 0) {
    const trimmed = content.trim();
    if (trimmed.length > 0) {
      const basename = filePath.split("/").pop() ?? filePath;
      chunks.push({
        content,
        symbolName: basename,
        symbolKind: "file",
        filePath,
        startLine: 1,
        endLine: content.split("\n").length,
      });
    }
  }

  return chunks;
}

const jsonChunker = { chunkCode };

export { jsonChunker };
