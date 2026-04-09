import type { NapiConfig, SgNode } from "@ast-grep/napi";
import type { NapiLang } from "@ast-grep/napi/types/lang";

type RawReference = {
  chunkSymbolName: string;
  referencedIdentifiers: string[];
};

type GraphAdapter = {
  /** ast-grep language identifier */
  lang: NapiLang;
  /** File extensions this adapter handles */
  extensions: string[];
  /** ast-grep rule to find identifier nodes */
  identifierRule: NapiConfig;
  /** Extract the identifier text from a matched node */
  getIdentifierName: (node: SgNode) => string;
  /** Optional: per-file lang override */
  getLang?: (filePath: string) => NapiLang;
};

export type { GraphAdapter, RawReference };
