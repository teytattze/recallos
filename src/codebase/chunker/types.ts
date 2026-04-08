import type { NapiConfig, SgNode } from "@ast-grep/napi";
import type { NapiLang } from "@ast-grep/napi/types/lang";

type Chunk = {
  content: string;
  symbolName: string;
  symbolKind: string;
  filePath: string;
  startLine: number;
  endLine: number;
};

type LanguageAdapter = {
  /** ast-grep language identifier */
  lang: NapiLang;
  /** File extensions this adapter handles */
  extensions: string[];
  /** The findAll rule that matches symbol nodes */
  symbolRule: NapiConfig;
  /** Extract a human-readable name from a matched node */
  getSymbolName: (node: SgNode) => string;
  /** Extract a symbol kind label from a matched node */
  getSymbolKind: (node: SgNode) => string;
  /** Optional: rule to find preamble nodes (imports, leading comments) */
  preambleRule?: NapiConfig;
  /** Optional: AST node kind for comments (enables leading comment attachment) */
  commentKind?: string;
  /** Optional: per-file lang override (e.g., Lang.Tsx for .tsx files) */
  getLang?: (filePath: string) => NapiLang;
  /** Optional: transform content before parsing (e.g., markdown → HTML) */
  preprocess?: (content: string) => string;
  /** Optional: full control over chunk assembly from matched nodes */
  postProcess?: (nodes: SgNode[], content: string, filePath: string) => Chunk[];
};

export type { Chunk, LanguageAdapter };
