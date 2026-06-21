import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./src",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  globalTimeout: 120_000,
  reporter: "list",
});
