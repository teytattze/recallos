import { parse, Lang, type SgNode } from "@ast-grep/napi";
import { deduplicateName, wholeFileChunk } from "@/codebase/chunker/util";
import type { Chunk } from "@/codebase/chunker/types";
import type { Kinds, TypesMap } from "@ast-grep/napi/types/staticTypes";

const SYMBOL_NODE_TYPES = new Set<Kinds<TypesMap>>([
  "function_declaration",
  "class_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  "lexical_declaration",
]);

const PREAMBLE_NODE_TYPES = new Set<Kinds<TypesMap>>([
  "import_statement",
  "comment",
]);

function getSymbolKind(nodeType: Kinds<TypesMap>): string {
  switch (nodeType) {
    case "function_declaration":
      return "function";
    case "class_declaration":
      return "class";
    case "interface_declaration":
      return "interface";
    case "type_alias_declaration":
      return "type";
    case "enum_declaration":
      return "enum";
    case "lexical_declaration":
      return "variable";
    default:
      return "unknown";
  }
}

function getSymbolName(node: SgNode): string {
  const nameNode = node.field("name");
  if (nameNode) return nameNode.text();

  if (node.kind() === "lexical_declaration") {
    for (const child of node.children()) {
      if (child.kind() === "variable_declarator") {
        const varName = child.field("name");
        if (varName) return varName.text();
      }
    }
  }

  return "_unnamed";
}

function unwrapExport(node: SgNode): {
  declaration: SgNode | null;
  isDefault: boolean;
} {
  const declaration = node.field("declaration");
  if (declaration) {
    return { declaration, isDefault: false };
  }

  // Check for export default
  for (const child of node.children()) {
    if (child.kind() === "default") {
      return { declaration: null, isDefault: true };
    }
  }

  return { declaration: null, isDefault: false };
}

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

function chunkCode(code: string, filePath: string): Chunk[] {
  const lang = filePath.endsWith(".tsx") ? Lang.Tsx : Lang.TypeScript;
  const root = parse(lang, code).root();
  const children = root.children();
  const chunks: Chunk[] = [];

  // Track which node indices have been consumed as preamble or leading comments
  const consumed = new Set<number>();

  // Phase 1: Identify preamble (leading imports + comments before first symbol)
  const preambleIndices: number[] = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (PREAMBLE_NODE_TYPES.has(child.kind())) {
      preambleIndices.push(i);
    } else {
      break;
    }
  }

  // Trim trailing comments from preamble if they're adjacent to the next symbol
  // (no blank line gap) — those are leading comments for the symbol, not preamble
  const nextChildIndex = preambleIndices.length;
  const nextChild = children[nextChildIndex];
  if (nextChild) {
    while (preambleIndices.length > 0) {
      const lastIdx = preambleIndices[preambleIndices.length - 1]!;
      const last = children[lastIdx]!;
      if (last.kind() !== "comment") break;
      const followingIdx = preambleIndices.length;
      const following = children[followingIdx];
      if (!following || hasBlankLineGap(code, last, following)) break;
      preambleIndices.pop();
    }
  }

  if (preambleIndices.length > 0) {
    const firstIdx = preambleIndices[0]!;
    const lastIdx = preambleIndices[preambleIndices.length - 1]!;
    const first = children[firstIdx]!;
    const last = children[lastIdx]!;
    const firstRange = first.range();
    const lastRange = last.range();
    chunks.push({
      content: code.slice(firstRange.start.index, lastRange.end.index),
      symbolName: "_preamble",
      symbolKind: "preamble",
      filePath,
      startLine: firstRange.start.line + 1,
      endLine: lastRange.end.line + 1,
    });
    for (const idx of preambleIndices) {
      consumed.add(idx);
    }
  }

  // Phase 2: Extract symbol chunks with leading comment attachment
  const nameCount = new Map<string, number>();

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (consumed.has(i)) continue;

    const targetNode = child;
    let symbolKind: string;
    let symbolName: string;

    if (child.kind() === "export_statement") {
      const { declaration, isDefault } = unwrapExport(child);
      if (declaration && SYMBOL_NODE_TYPES.has(declaration.kind())) {
        symbolKind = getSymbolKind(declaration.kind());
        symbolName = getSymbolName(declaration);
      } else if (isDefault) {
        symbolKind = "export";
        symbolName = "_default";
      } else {
        // Bare export statement (e.g., export { foo })
        symbolKind = "export";
        symbolName = `_export_${i}`;
      }
    } else if (SYMBOL_NODE_TYPES.has(child.kind())) {
      symbolKind = getSymbolKind(child.kind());
      symbolName = getSymbolName(child);
    } else if (child.kind() === "comment") {
      // Standalone comment not part of preamble — will be attached to next symbol or skipped
      continue;
    } else if (child.kind() === "expression_statement") {
      // Top-level expression statements (e.g., module.exports = ...)
      symbolKind = "expression";
      symbolName = `_expr_${i}`;
    } else {
      // Other top-level statements
      symbolKind = "statement";
      symbolName = `_stmt_${i}`;
    }

    const targetRange = targetNode.range();
    let contentStart = targetRange.start.index;
    let lineStart = targetRange.start.line + 1;

    const prevIndex = i - 1;
    if (prevIndex >= 0) {
      // Walk backward through preceding comment nodes
      let j = prevIndex;
      while (j >= 0) {
        const prev = children[j]!;
        if (consumed.has(j)) break;
        if (prev.kind() !== "comment") break;
        if (hasBlankLineGap(code, prev, children[j + 1]!)) break;
        j--;
      }
      // Attach comments from j+1 to prevIndex
      for (let k = j + 1; k <= prevIndex; k++) {
        const commentNode = children[k]!;
        if (commentNode.kind() === "comment" && !consumed.has(k)) {
          if (!hasBlankLineGap(code, commentNode, targetNode)) {
            contentStart = commentNode.range().start.index;
            lineStart = commentNode.range().start.line + 1;
            consumed.add(k);
          }
        }
      }
    }

    const finalName = deduplicateName(nameCount, symbolName);

    chunks.push({
      content: code.slice(contentStart, targetRange.end.index),
      symbolName: finalName,
      symbolKind,
      filePath,
      startLine: lineStart,
      endLine: targetRange.end.line + 1,
    });

    consumed.add(i);
  }

  if (chunks.length === 0 && code.trim().length > 0) {
    chunks.push(wholeFileChunk(code, filePath));
  }

  return chunks;
}

const typescriptChunker = { chunkCode };

export { typescriptChunker };
