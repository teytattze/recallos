import { registerDynamicLanguage } from "@ast-grep/napi";
import json from "@ast-grep/lang-json";
import type { LanguageAdapter } from "@/codebase/chunker/types";

registerDynamicLanguage({ json });

function unquote(text: string): string {
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  return text;
}

const jsonAdapter: LanguageAdapter = {
  lang: "json",
  extensions: [".json"],

  symbolRule: {
    rule: {
      kind: "pair",
      inside: {
        kind: "object",
        inside: { kind: "document", stopBy: "neighbor" },
        stopBy: "neighbor",
      },
    },
  },

  getSymbolName(node) {
    const key = node.field("key");
    return key ? unquote(key.text()) : "_unnamed";
  },

  getSymbolKind() {
    return "property";
  },
};

export { jsonAdapter };
