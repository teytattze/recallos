import Parser from "tree-sitter";
import TreeSitterTypeScript from "tree-sitter-typescript";
import type { Chunk } from "./types";

const parser = new Parser();
parser.setLanguage(
  TreeSitterTypeScript.typescript as unknown as Parser.Language,
);

const SYMBOL_NODE_TYPES = new Set([
  "function_declaration",
  "class_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  "lexical_declaration",
]);

const PREAMBLE_NODE_TYPES = new Set(["import_statement", "comment"]);

function getSymbolKind(nodeType: string): string {
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

function getSymbolName(node: Parser.SyntaxNode): string {
  const nameNode = node.childForFieldName("name");
  if (nameNode) return nameNode.text;

  // For lexical_declaration, get the name from the first variable_declarator
  if (node.type === "lexical_declaration") {
    for (const child of node.children) {
      if (child.type === "variable_declarator") {
        const varName = child.childForFieldName("name");
        if (varName) return varName.text;
      }
    }
  }

  return "_unnamed";
}

function unwrapExport(node: Parser.SyntaxNode): {
  declaration: Parser.SyntaxNode | null;
  isDefault: boolean;
} {
  const declaration = node.childForFieldName("declaration");
  if (declaration) {
    return { declaration, isDefault: false };
  }

  // Check for export default
  for (const child of node.children) {
    if (child.type === "default") {
      return { declaration: null, isDefault: true };
    }
  }

  return { declaration: null, isDefault: false };
}

function hasBlankLineGap(
  code: string,
  prevNode: Parser.SyntaxNode,
  nextNode: Parser.SyntaxNode,
): boolean {
  const between = code.slice(prevNode.endIndex, nextNode.startIndex);
  return between.includes("\n\n");
}

function chunkCode(code: string, filePath: string): Chunk[] {
  const tree = parser.parse(code);
  const rootNode = tree.rootNode;
  const children = rootNode.children;
  const chunks: Chunk[] = [];

  // Track which nodes have been consumed as preamble or leading comments
  const consumed = new Set<number>();

  // Phase 1: Identify preamble (leading imports + comments before first symbol)
  const preambleNodes: Parser.SyntaxNode[] = [];
  for (const child of children) {
    if (PREAMBLE_NODE_TYPES.has(child.type)) {
      preambleNodes.push(child);
    } else {
      break;
    }
  }

  // Trim trailing comments from preamble if they're adjacent to the next symbol
  // (no blank line gap) — those are leading comments for the symbol, not preamble
  const nextChildIndex = preambleNodes.length;
  const nextChild = children[nextChildIndex];
  if (nextChild) {
    while (preambleNodes.length > 0) {
      const last = preambleNodes[preambleNodes.length - 1]!;
      if (last.type !== "comment") break;
      const following = children[preambleNodes.length];
      if (!following || hasBlankLineGap(code, last, following)) break;
      preambleNodes.pop();
    }
  }

  if (preambleNodes.length > 0) {
    const first = preambleNodes[0]!;
    const last = preambleNodes[preambleNodes.length - 1]!;
    chunks.push({
      content: code.slice(first.startIndex, last.endIndex),
      symbolName: "_preamble",
      symbolKind: "preamble",
      filePath,
      startLine: first.startPosition.row + 1,
      endLine: last.endPosition.row + 1,
    });
    for (const node of preambleNodes) {
      consumed.add(node.id);
    }
  }

  // Phase 2: Extract symbol chunks with leading comment attachment
  const nameCount = new Map<string, number>();

  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (consumed.has(child.id)) continue;

    let targetNode = child;
    let symbolKind: string;
    let symbolName: string;

    if (child.type === "export_statement") {
      const { declaration, isDefault } = unwrapExport(child);
      if (declaration && SYMBOL_NODE_TYPES.has(declaration.type)) {
        symbolKind = getSymbolKind(declaration.type);
        symbolName = getSymbolName(declaration);
      } else if (isDefault) {
        symbolKind = "export";
        symbolName = "_default";
      } else {
        // Bare export statement (e.g., export { foo })
        symbolKind = "export";
        symbolName = `_export_${i}`;
      }
    } else if (SYMBOL_NODE_TYPES.has(child.type)) {
      symbolKind = getSymbolKind(child.type);
      symbolName = getSymbolName(child);
    } else if (child.type === "comment") {
      // Standalone comment not part of preamble — will be attached to next symbol or skipped
      continue;
    } else if (child.type === "expression_statement") {
      // Top-level expression statements (e.g., module.exports = ...)
      symbolKind = "expression";
      symbolName = `_expr_${i}`;
    } else {
      // Other top-level statements
      symbolKind = "statement";
      symbolName = `_stmt_${i}`;
    }

    // Collect leading comments (walk backward from current node)
    let contentStart = targetNode.startIndex;
    let lineStart = targetNode.startPosition.row + 1;

    const prevIndex = i - 1;
    if (prevIndex >= 0) {
      // Walk backward through preceding comment nodes
      let j = prevIndex;
      while (j >= 0) {
        const prev = children[j]!;
        if (consumed.has(prev.id)) break;
        if (prev.type !== "comment") break;
        if (hasBlankLineGap(code, prev, children[j + 1]!)) break;
        j--;
      }
      // Attach comments from j+1 to prevIndex
      for (let k = j + 1; k <= prevIndex; k++) {
        const commentNode = children[k]!;
        if (commentNode.type === "comment" && !consumed.has(commentNode.id)) {
          if (!hasBlankLineGap(code, commentNode, targetNode)) {
            contentStart = commentNode.startIndex;
            lineStart = commentNode.startPosition.row + 1;
            consumed.add(commentNode.id);
          }
        }
      }
    }

    // Handle duplicate symbol names
    const count = nameCount.get(symbolName) ?? 0;
    nameCount.set(symbolName, count + 1);
    const finalName = count > 0 ? `${symbolName}_${count + 1}` : symbolName;

    chunks.push({
      content: code.slice(contentStart, targetNode.endIndex),
      symbolName: finalName,
      symbolKind,
      filePath,
      startLine: lineStart,
      endLine: targetNode.endPosition.row + 1,
    });

    consumed.add(child.id);
  }

  // Fallback: if no chunks were produced, return the entire file as one chunk
  if (chunks.length === 0) {
    const trimmed = code.trim();
    if (trimmed.length > 0) {
      const basename = filePath.split("/").pop() ?? filePath;
      chunks.push({
        content: code,
        symbolName: basename,
        symbolKind: "file",
        filePath,
        startLine: 1,
        endLine: code.split("\n").length,
      });
    }
  }

  return chunks;
}

const typescriptChunker = { chunkCode };

export { typescriptChunker };
