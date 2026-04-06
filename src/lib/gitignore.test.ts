import { gitignore } from "@/lib/gitignore";
import { describe, expect, it } from "bun:test";

describe("gitignore.parseContent", () => {
  it("strips comments and empty lines", () => {
    const content = `# comment
node_modules

# another comment
dist
`;
    expect(gitignore.parseContent(content)).toEqual([
      "node_modules/**",
      "dist/**",
    ]);
  });

  it("appends /** to directory-style patterns", () => {
    expect(gitignore.parseContent("node_modules\ncoverage\nout")).toEqual([
      "node_modules/**",
      "coverage/**",
      "out/**",
    ]);
  });

  it("preserves patterns with extensions", () => {
    expect(gitignore.parseContent("*.log\n*.lcov\n.DS_Store")).toEqual([
      "*.log",
      "*.lcov",
      ".DS_Store",
    ]);
  });

  it("preserves patterns with existing glob suffixes", () => {
    expect(gitignore.parseContent("src/**\nlib/*")).toEqual([
      "src/**",
      "lib/*",
    ]);
  });

  it("preserves patterns with wildcards", () => {
    expect(gitignore.parseContent("*.tgz\nreport.[0-9]*.json")).toEqual([
      "*.tgz",
      "report.[0-9]*.json",
    ]);
  });

  it("handles .env-style patterns", () => {
    expect(gitignore.parseContent(".env\n.env.local")).toEqual([
      ".env",
      ".env.local",
    ]);
  });

  it("returns empty array for empty content", () => {
    expect(gitignore.parseContent("")).toEqual([]);
    expect(gitignore.parseContent("# just a comment\n")).toEqual([]);
  });
});

describe("gitignore.loadPatterns", () => {
  it("returns patterns from the repo .gitignore", () => {
    const patterns = gitignore.loadPatterns();
    expect(patterns).toContain("node_modules/**");
    expect(patterns).toContain("dist/**");
  });

  it("returns empty array when .gitignore does not exist", () => {
    const patterns = gitignore.loadPatterns("/nonexistent/path");
    expect(patterns).toEqual([]);
  });
});
