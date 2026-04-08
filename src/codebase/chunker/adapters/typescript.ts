import { Lang, type SgNode } from "@ast-grep/napi";
import type { Kinds, TypesMap } from "@ast-grep/napi/types/staticTypes";
import type { LanguageAdapter } from "@/codebase/chunker/types";

function getSymbolKind(nodeType: string | Kinds<TypesMap>): string {
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

function extractName(node: SgNode): string {
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

const SYMBOL_KINDS = [
  "function_declaration",
  "class_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  "lexical_declaration",
] as const;

const typescriptAdapter: LanguageAdapter = {
  lang: Lang.TypeScript,
  extensions: [".ts", ".tsx"],

  getLang(filePath) {
    return filePath.endsWith(".tsx") ? Lang.Tsx : Lang.TypeScript;
  },

  symbolRule: {
    rule: {
      any: [
        { kind: "function_declaration" },
        { kind: "class_declaration" },
        { kind: "interface_declaration" },
        { kind: "type_alias_declaration" },
        { kind: "enum_declaration" },
        { kind: "lexical_declaration" },
        { kind: "export_statement" },
        { kind: "expression_statement" },
      ],
      inside: { kind: "program", stopBy: "neighbor" },
    },
  },

  preambleRule: {
    rule: {
      any: [{ kind: "import_statement" }, { kind: "comment" }],
      inside: { kind: "program", stopBy: "neighbor" },
    },
  },

  commentKind: "comment",

  getSymbolName(node) {
    if (node.kind() === "export_statement") {
      const declaration = node.field("declaration");
      if (declaration) return extractName(declaration);
      for (const child of node.children()) {
        if (child.kind() === "default") return "_default";
      }
      return "_export";
    }
    if (node.kind() === "expression_statement") {
      return "_expr";
    }
    return extractName(node);
  },

  getSymbolKind(node) {
    if (node.kind() === "export_statement") {
      const declaration = node.field("declaration");
      if (declaration && SYMBOL_KINDS.includes(declaration.kind() as any)) {
        return getSymbolKind(declaration.kind());
      }
      return "export";
    }
    if (node.kind() === "expression_statement") {
      return "expression";
    }
    return getSymbolKind(node.kind());
  },
};

export { typescriptAdapter };
