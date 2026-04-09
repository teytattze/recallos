import { parse } from "@ast-grep/napi";
import type { Chunk } from "@/codebase/chunker/types";
import type { GraphAdapter, RawReference } from "@/codebase/graph/types";

function extractWithAdapter(
  content: string,
  filePath: string,
  chunks: Chunk[],
  adapter: GraphAdapter,
): RawReference[] {
  if (content.trim().length === 0) return [];

  const lang = adapter.getLang?.(filePath) ?? adapter.lang;
  const root = parse(lang, content).root();
  const identifierNodes = root.findAll(adapter.identifierRule);

  const refs: RawReference[] = [];

  for (const chunk of chunks) {
    const identifiers = new Set<string>();

    for (const node of identifierNodes) {
      const line = node.range().start.line + 1; // ast-grep is 0-indexed
      if (line >= chunk.startLine && line <= chunk.endLine) {
        const name = adapter.getIdentifierName(node);
        // Exclude self-references
        if (name !== chunk.symbolName) {
          identifiers.add(name);
        }
      }
    }

    if (identifiers.size > 0) {
      refs.push({
        chunkSymbolName: chunk.symbolName,
        referencedIdentifiers: [...identifiers],
      });
    }
  }

  return refs;
}

export { extractWithAdapter };
