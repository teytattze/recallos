import { Lang } from "@ast-grep/napi";
import type { GraphAdapter } from "@/codebase/graph/types";

const typescriptGraphAdapter: GraphAdapter = {
  lang: Lang.TypeScript,
  extensions: [".ts", ".tsx"],

  getLang(filePath) {
    return filePath.endsWith(".tsx") ? Lang.Tsx : Lang.TypeScript;
  },

  identifierRule: {
    rule: {
      any: [{ kind: "identifier" }, { kind: "type_identifier" }],
    },
  },

  getIdentifierName(node) {
    return node.text();
  },
};

export { typescriptGraphAdapter };
