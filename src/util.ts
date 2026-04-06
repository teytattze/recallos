import { readFileSync } from "node:fs";
import { glob } from "glob/raw";

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

const hashContent = (content: string): string => {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex") as string;
};

const util = {
  loadFiles,
  hashContent,
};

export { util };
