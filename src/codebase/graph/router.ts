import { parse } from "@ast-grep/napi";
import type { GraphAdapter } from "@/codebase/graph/types";
import { typescriptGraphAdapter } from "@/codebase/graph/adapters/typescript";

const ADAPTERS: GraphAdapter[] = [typescriptGraphAdapter];

const EXTENSION_MAP = new Map<string, GraphAdapter>();
for (const adapter of ADAPTERS) {
  for (const ext of adapter.extensions) {
    EXTENSION_MAP.set(ext, adapter);
  }
}

function getExtension(filePath: string): string {
  const basename = filePath.split("/").pop() ?? filePath;
  const dot = basename.lastIndexOf(".");
  return dot === -1 ? "" : basename.slice(dot);
}

function extractImports(content: string, filePath: string): string[] {
  const ext = getExtension(filePath);
  const adapter = EXTENSION_MAP.get(ext);
  if (!adapter) return [];
  if (content.trim().length === 0) return [];

  const lang = adapter.getLang?.(filePath) ?? adapter.lang;
  const root = parse(lang, content).root();
  const nodes = root.findAll(adapter.importRule);

  const seen = new Set<string>();
  const specifiers: string[] = [];

  for (const node of nodes) {
    const spec = adapter.getImportSpecifier(node);
    if (spec && !seen.has(spec)) {
      seen.add(spec);
      specifiers.push(spec);
    }
  }

  return specifiers;
}

export { extractImports, getExtension };
