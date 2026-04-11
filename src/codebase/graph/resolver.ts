import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

type AliasConfig = {
  prefix: string;
  target: string;
};

const DEFAULT_ALIASES: AliasConfig[] = [{ prefix: "@/", target: "src/" }];

const TS_EXTENSIONS = [".ts", ".tsx"];
const INDEX_FILES = ["index.ts", "index.tsx"];

function tryResolveFile(
  basePath: string,
  fileExists: (p: string) => boolean = existsSync,
): string | null {
  if (fileExists(basePath)) return basePath;

  for (const ext of TS_EXTENSIONS) {
    const withExt = basePath + ext;
    if (fileExists(withExt)) return withExt;
  }

  for (const idx of INDEX_FILES) {
    const indexPath = join(basePath, idx);
    if (fileExists(indexPath)) return indexPath;
  }

  return null;
}

function resolveSpecifier(
  specifier: string,
  importerPath: string,
  projectRoot: string,
  aliases: AliasConfig[] = DEFAULT_ALIASES,
  fileExists: (p: string) => boolean = existsSync,
): string | null {
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const matchedAlias = aliases.find((a) => specifier.startsWith(a.prefix));

  if (!isRelative && !matchedAlias) return null;

  let absolutePath: string;

  if (matchedAlias) {
    const remainder = specifier.slice(matchedAlias.prefix.length);
    absolutePath = resolve(projectRoot, matchedAlias.target, remainder);
  } else {
    const importerDir = dirname(resolve(projectRoot, importerPath));
    absolutePath = resolve(importerDir, specifier);
  }

  const resolved = tryResolveFile(absolutePath, fileExists);
  if (!resolved) return null;

  const prefix = projectRoot.endsWith("/") ? projectRoot : projectRoot + "/";
  return resolved.startsWith(prefix)
    ? resolved.slice(prefix.length)
    : resolved.slice(projectRoot.length);
}

export { resolveSpecifier, tryResolveFile };
export type { AliasConfig };
