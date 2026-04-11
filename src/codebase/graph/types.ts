import type { NapiConfig, SgNode } from "@ast-grep/napi";
import type { NapiLang } from "@ast-grep/napi/types/lang";

type GraphAdapter = {
  /** ast-grep language identifier */
  lang: NapiLang;
  /** File extensions this adapter handles */
  extensions: string[];
  /** Optional: per-file lang override (e.g., Lang.Tsx for .tsx files) */
  getLang?: (filePath: string) => NapiLang;
  /** The findAll rule that matches import/export-from nodes */
  importRule: NapiConfig;
  /** Extract the raw module specifier string from a matched node */
  getImportSpecifier: (node: SgNode) => string;
};

export type { GraphAdapter };
