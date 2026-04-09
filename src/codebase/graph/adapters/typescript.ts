import { Lang, type SgNode } from "@ast-grep/napi";
import type { GraphAdapter } from "@/codebase/graph/types";

const typescriptGraphAdapter: GraphAdapter = {
  lang: Lang.TypeScript,
  extensions: [".ts", ".tsx"],

  getLang(filePath) {
    return filePath.endsWith(".tsx") ? Lang.Tsx : Lang.TypeScript;
  },

  importRule: {
    rule: {
      any: [
        { kind: "import_statement" },
        {
          kind: "export_statement",
          has: { field: "source", kind: "string" },
        },
        {
          kind: "call_expression",
          has: {
            field: "function",
            kind: "import",
          },
        },
      ],
    },
  },

  getImportSpecifier(node: SgNode): string {
    const source = node.field("source");
    if (source) {
      const text = source.text();
      return text.slice(1, -1);
    }

    if (node.kind() === "call_expression") {
      const args = node.field("arguments");
      if (args) {
        for (const child of args.children()) {
          if (child.kind() === "string") {
            const text = child.text();
            return text.slice(1, -1);
          }
        }
      }
    }

    return "";
  },
};

export { typescriptGraphAdapter };
