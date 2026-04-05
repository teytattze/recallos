import { client } from "./client";
import { codeMemory } from "./code-memory";
import { util } from "./util";

// Clear stale data before re-seeding
try {
  await client.chromadb.deleteCollection({ name: "code_collection" });
} catch {
  // Collection may not exist yet
}

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
