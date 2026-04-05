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

const util = {
  loadFiles,
};

export { util };
