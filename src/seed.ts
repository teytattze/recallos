import { codeMemory } from "./code-memory";
import { util } from "./util";

const files = await util.loadFiles({
  excludePatterns: ["node_modules/**"],
  includePatterns: ["src/**/*.ts"],
});

await Promise.all(
  files.map((file) =>
    codeMemory.write({
      code: file.content,
      filePath: file.path,
    }),
  ),
);
