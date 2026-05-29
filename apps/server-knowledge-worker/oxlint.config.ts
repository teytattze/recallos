import { defineConfig } from "oxlint";

import baseConfig from "../../oxlint.config.ts";

export default defineConfig({
  extends: [baseConfig],
  plugins: ["node"],
  rules: {},
  overrides: [],
});
