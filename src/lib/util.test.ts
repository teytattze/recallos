import { test, expect } from "bun:test";
import {
  hash,
  toGlobPattern,
  parseGitignoreContent,
} from "@/lib/util";

// -- toGlobPattern --

test("toGlobPattern: given pattern ending with /**, when converted, then returns pattern unchanged", () => {
  // Given
  const pattern = "node_modules/**";

  // When
  const result = toGlobPattern(pattern);

  // Then
  expect(result).toBe("node_modules/**");
});

test("toGlobPattern: given pattern ending with /*, when converted, then returns pattern unchanged", () => {
  // Given
  const pattern = "dist/*";

  // When
  const result = toGlobPattern(pattern);

  // Then
  expect(result).toBe("dist/*");
});

test("toGlobPattern: given pattern containing wildcard *, when converted, then returns pattern unchanged", () => {
  // Given
  const pattern = "*.log";

  // When
  const result = toGlobPattern(pattern);

  // Then
  expect(result).toBe("*.log");
});

test("toGlobPattern: given pattern containing a dot, when converted, then returns pattern unchanged", () => {
  // Given
  const pattern = ".env";

  // When
  const result = toGlobPattern(pattern);

  // Then
  expect(result).toBe(".env");
});

test("toGlobPattern: given bare directory name, when converted, then appends /**", () => {
  // Given
  const pattern = "node_modules";

  // When
  const result = toGlobPattern(pattern);

  // Then
  expect(result).toBe("node_modules/**");
});

// -- parseGitignoreContent --

test("parseGitignoreContent: given content with comments and blanks, when parsed, then filters them out", () => {
  // Given
  const content = "# comment\n\nnode_modules\n  \n# another comment";

  // When
  const result = parseGitignoreContent(content);

  // Then
  expect(result).toEqual(["node_modules/**"]);
});

test("parseGitignoreContent: given directory entries, when parsed, then converts to glob patterns", () => {
  // Given
  const content = "dist\nbuild\ncoverage";

  // When
  const result = parseGitignoreContent(content);

  // Then
  expect(result).toEqual(["dist/**", "build/**", "coverage/**"]);
});

test("parseGitignoreContent: given empty string, when parsed, then returns empty array", () => {
  // Given
  const content = "";

  // When
  const result = parseGitignoreContent(content);

  // Then
  expect(result).toEqual([]);
});

test("parseGitignoreContent: given mixed file and directory patterns, when parsed, then preserves files and converts directories", () => {
  // Given
  const content = "node_modules\n*.log\n.env\ndist";

  // When
  const result = parseGitignoreContent(content);

  // Then
  expect(result).toEqual(["node_modules/**", "*.log", ".env", "dist/**"]);
});

// -- hash --

test("hash: given a string, when hashed, then returns 64-char hex string", () => {
  // Given
  const input = "hello world";

  // When
  const result = hash(input);

  // Then
  expect(result).toHaveLength(64);
  expect(result).toMatch(/^[0-9a-f]{64}$/);
});

test("hash: given the same input twice, when hashed, then returns identical output", () => {
  // Given
  const input = "deterministic";

  // When
  const first = hash(input);
  const second = hash(input);

  // Then
  expect(first).toBe(second);
});

test("hash: given two different inputs, when hashed, then returns different outputs", () => {
  // Given
  const inputA = "hello";
  const inputB = "world";

  // When
  const hashA = hash(inputA);
  const hashB = hash(inputB);

  // Then
  expect(hashA).not.toBe(hashB);
});

test("hash: given empty string, when hashed, then returns valid sha256 hex digest", () => {
  // Given
  const input = "";

  // When
  const result = hash(input);

  // Then
  expect(result).toHaveLength(64);
  expect(result).toMatch(/^[0-9a-f]{64}$/);
});
