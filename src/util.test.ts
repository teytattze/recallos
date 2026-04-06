import { test, expect } from "bun:test";
import { util } from "./util";

test("hashContent returns a 64-character hex string", () => {
  const hash = util.hashContent("hello world");
  expect(hash).toHaveLength(64);
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
});

test("hashContent is deterministic", () => {
  const a = util.hashContent("test content");
  const b = util.hashContent("test content");
  expect(a).toBe(b);
});

test("hashContent returns different hashes for different input", () => {
  const a = util.hashContent("file a");
  const b = util.hashContent("file b");
  expect(a).not.toBe(b);
});

test("hashContent handles empty string", () => {
  const hash = util.hashContent("");
  expect(hash).toHaveLength(64);
  // Known SHA-256 of empty string
  expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});
