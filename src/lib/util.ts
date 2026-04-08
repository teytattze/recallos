import { existsSync, readFileSync } from "node:fs";
import { glob } from "glob/raw";
import { resolve } from "node:path";

const loadFiles = async (input: {
  excludePatterns: string[];
  includePatterns: string[];
}) => {
  const { excludePatterns, includePatterns } = input;
  const filePaths = await glob(includePatterns, { ignore: excludePatterns });
  return filePaths.map((filePath) => ({
    path: filePath,
    content: readFileSync(filePath, "utf8"),
  }));
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

const parseGitignoreContent = (content: string): string[] => {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map(toGlobPattern);
};

const loadGitignorePatterns = (cwd: string = process.cwd()): string[] => {
  const gitignorePath = resolve(cwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return [];
  }
  const content = readFileSync(gitignorePath, "utf8");
  return parseGitignoreContent(content);
};

const hash = (value: string): string => {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(value);
  return hasher.digest("hex") as string;
};

export {
  loadFiles,
  loadGitignorePatterns,
  hash,
  toGlobPattern,
  parseGitignoreContent,
};
