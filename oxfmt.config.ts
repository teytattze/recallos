import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 80,

  ignorePatterns: ["packages/server-database/src/generated/**/*"],

  sortImports: {
    groups: [
      "type-import",
      ["value-builtin", "value-external"],
      "type-internal",
      "value-internal",
      ["type-parent", "type-sibling", "type-index"],
      ["value-parent", "value-sibling", "value-index"],
      "unknown",
    ],
  },

  sortTailwindcss: {
    functions: ["clsx", "cn"],
  },

  sortPackageJson: {
    sortScripts: true,
  },
});
