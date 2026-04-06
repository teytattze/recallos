import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const parseContent = (content: string): string[] => {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map(toGlobPattern);
};

const toGlobPattern = (pattern: string): string => {
  // Already has glob wildcard suffix — keep as-is
  if (pattern.endsWith("/**") || pattern.endsWith("/*")) {
    return pattern;
  }
  // File-specific patterns (have extension or contain wildcard) — keep as-is
  if (pattern.includes("*") || pattern.includes(".")) {
    return pattern;
  }
  // Directory-style pattern — append /** to match all contents
  return `${pattern}/**`;
};

const loadPatterns = (cwd: string = process.cwd()): string[] => {
  const gitignorePath = resolve(cwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return [];
  }
  const content = readFileSync(gitignorePath, "utf8");
  return parseContent(content);
};

const gitignore = {
  loadPatterns,
  parseContent,
};

export { gitignore };
