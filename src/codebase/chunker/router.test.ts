import { test, expect } from "bun:test";
import { getExtension } from "@/codebase/chunker/router";

test("getExtension: given file path with .ts extension, when extracted, then returns .ts", () => {
  // Given
  const filePath = "src/index.ts";

  // When
  const result = getExtension(filePath);

  // Then
  expect(result).toBe(".ts");
});

test("getExtension: given file with no extension, when extracted, then returns empty string", () => {
  // Given
  const filePath = "Makefile";

  // When
  const result = getExtension(filePath);

  // Then
  expect(result).toBe("");
});

test("getExtension: given file with multiple dots, when extracted, then returns last extension", () => {
  // Given
  const filePath = "src/config.test.ts";

  // When
  const result = getExtension(filePath);

  // Then
  expect(result).toBe(".ts");
});

test("getExtension: given dot only in directory component, when extracted, then returns empty string", () => {
  // Given
  const filePath = "src/.config/myfile";

  // When
  const result = getExtension(filePath);

  // Then
  expect(result).toBe("");
});

test("getExtension: given hidden file like .gitignore, when extracted, then returns .gitignore", () => {
  // Given
  const filePath = ".gitignore";

  // When
  const result = getExtension(filePath);

  // Then
  expect(result).toBe(".gitignore");
});
