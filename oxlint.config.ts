import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: [
    "eslint",
    "import",
    "jsdoc",
    "oxc",
    "promise",
    "typescript",
    "unicorn",
  ],

  options: {
    typeAware: true,
    typeCheck: true,
  },

  overrides: [
    {
      files: ["*.test.ts", "*.test.tsx"],
      rules: {
        "typescript/no-floating-promises": "allow",
      },
    },
  ],
});
