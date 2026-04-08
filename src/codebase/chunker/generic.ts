import { parse, type SgNode } from "@ast-grep/napi";
import { deduplicateName, wholeFileChunk } from "@/codebase/chunker/util";
import type { Chunk, LanguageAdapter } from "@/codebase/chunker/types";

function hasBlankLineGap(
  code: string,
  prevNode: SgNode,
  nextNode: SgNode,
): boolean {
  const between = code.slice(
    prevNode.range().end.index,
    nextNode.range().start.index,
  );
  return between.includes("\n\n");
}

function chunkWithAdapter(
  content: string,
  filePath: string,
  adapter: LanguageAdapter,
): Chunk[] {
  if (content.trim().length === 0) return [];

  const preprocessed = adapter.preprocess?.(content) ?? content;
  const lang = adapter.getLang?.(filePath) ?? adapter.lang;
  const root = parse(lang, preprocessed).root();
  const symbolNodes = root.findAll(adapter.symbolRule);

  // If adapter defines postProcess, delegate entirely
  if (adapter.postProcess) {
    return adapter.postProcess(symbolNodes, preprocessed, filePath);
  }

  const chunks: Chunk[] = [];
  const consumed = new Set<number>();

  // Phase 1: Preamble extraction
  if (adapter.preambleRule) {
    const preambleNodes = root.findAll(adapter.preambleRule);

    // Collect consecutive preamble nodes from the start of the file
    const children = root.children();
    const preambleIndices: number[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      if (preambleNodes.some((p) => p.id() === child.id())) {
        preambleIndices.push(i);
      } else {
        break;
      }
    }

    // Trim trailing comments adjacent to the next symbol (no blank line gap)
    if (adapter.commentKind) {
      const nextChild = children[preambleIndices.length];
      if (nextChild) {
        while (preambleIndices.length > 0) {
          const lastIdx = preambleIndices[preambleIndices.length - 1]!;
          const last = children[lastIdx]!;
          if (last.kind() !== adapter.commentKind) break;
          const following = children[preambleIndices.length];
          if (!following || hasBlankLineGap(preprocessed, last, following))
            break;
          preambleIndices.pop();
        }
      }
    }

    if (preambleIndices.length > 0) {
      const first = children[preambleIndices[0]!]!;
      const last = children[preambleIndices[preambleIndices.length - 1]!]!;
      const firstRange = first.range();
      const lastRange = last.range();
      chunks.push({
        content: preprocessed.slice(
          firstRange.start.index,
          lastRange.end.index,
        ),
        symbolName: "_preamble",
        symbolKind: "preamble",
        filePath,
        startLine: firstRange.start.line + 1,
        endLine: lastRange.end.line + 1,
      });
      for (const idx of preambleIndices) {
        consumed.add(children[idx]!.id());
      }
    }
  }

  // Phase 2: Symbol chunks with optional leading comment attachment
  const nameCount = new Map<string, number>();
  const children = root.children();

  for (const symbolNode of symbolNodes) {
    if (consumed.has(symbolNode.id())) continue;

    const symbolName = adapter.getSymbolName(symbolNode);
    const symbolKind = adapter.getSymbolKind(symbolNode);
    const targetRange = symbolNode.range();

    let contentStart = targetRange.start.index;
    let lineStart = targetRange.start.line + 1;

    // Attach leading comments if commentKind is configured
    if (adapter.commentKind) {
      // Find this node's index in root children
      const nodeIndex = children.findIndex((c) => c.id() === symbolNode.id());
      if (nodeIndex > 0) {
        let j = nodeIndex - 1;
        while (j >= 0) {
          const prev = children[j]!;
          if (consumed.has(prev.id())) break;
          if (prev.kind() !== adapter.commentKind) break;
          if (hasBlankLineGap(preprocessed, prev, children[j + 1]!)) break;
          j--;
        }
        for (let k = j + 1; k < nodeIndex; k++) {
          const commentNode = children[k]!;
          if (
            commentNode.kind() === adapter.commentKind &&
            !consumed.has(commentNode.id())
          ) {
            if (!hasBlankLineGap(preprocessed, commentNode, symbolNode)) {
              contentStart = commentNode.range().start.index;
              lineStart = commentNode.range().start.line + 1;
              consumed.add(commentNode.id());
            }
          }
        }
      }
    }

    const finalName = deduplicateName(nameCount, symbolName);

    chunks.push({
      content: preprocessed.slice(contentStart, targetRange.end.index),
      symbolName: finalName,
      symbolKind,
      filePath,
      startLine: lineStart,
      endLine: targetRange.end.line + 1,
    });

    consumed.add(symbolNode.id());
  }

  if (chunks.length === 0 && preprocessed.trim().length > 0) {
    chunks.push(wholeFileChunk(preprocessed, filePath));
  }

  return chunks;
}

export { chunkWithAdapter };
