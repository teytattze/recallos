import { test, expect, describe } from "bun:test";
import { markdownChunker } from "@/codebase/chunker/markdown";

describe("markdownChunker", () => {
  test("extracts h1 sections", async () => {
    const content = `# Introduction

Some intro text.

# Getting Started

Setup instructions here.`;

    const chunks = await markdownChunker.chunkCode(content, "README.md");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.symbolName).toBe("Introduction");
    expect(chunks[0]!.symbolKind).toBe("section");
    expect(chunks[0]!.content).toContain("Some intro text.");
    expect(chunks[1]!.symbolName).toBe("Getting Started");
    expect(chunks[1]!.content).toContain("Setup instructions here.");
  });

  test("extracts h2 sections", async () => {
    const content = `## Overview

Overview content.

## Details

Detail content.`;

    const chunks = await markdownChunker.chunkCode(content, "doc.md");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.symbolName).toBe("Overview");
    expect(chunks[1]!.symbolName).toBe("Details");
  });

  test("keeps h3+ content within parent h1/h2 section", async () => {
    const content = `# Main Section

Intro.

### Subsection A

Sub content A.

### Subsection B

Sub content B.`;

    const chunks = await markdownChunker.chunkCode(content, "doc.md");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.symbolName).toBe("Main Section");
    expect(chunks[0]!.content).toContain("Subsection A");
    expect(chunks[0]!.content).toContain("Sub content B");
  });

  test("extracts preamble before first heading", async () => {
    const content = `Some intro paragraph before any heading.

Another paragraph.

# First Section

Section content.`;

    const chunks = await markdownChunker.chunkCode(content, "doc.md");
    const preamble = chunks.find((c) => c.symbolName === "_preamble");
    expect(preamble).toBeDefined();
    expect(preamble!.symbolKind).toBe("preamble");
    expect(preamble!.content).toContain("Some intro paragraph");
    expect(preamble!.content).toContain("Another paragraph");

    const section = chunks.find((c) => c.symbolName === "First Section");
    expect(section).toBeDefined();
  });

  test("handles no headings - falls back to whole file", async () => {
    const content = `Just some plain text without any headings.

And another paragraph.`;

    const chunks = await markdownChunker.chunkCode(content, "notes.md");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.symbolKind).toBe("file");
    expect(chunks[0]!.symbolName).toBe("notes.md");
    expect(chunks[0]!.content).toContain("Just some plain text");
  });

  test("handles empty file", async () => {
    const chunks = await markdownChunker.chunkCode("", "empty.md");
    expect(chunks).toHaveLength(0);
  });

  test("handles whitespace-only file", async () => {
    const chunks = await markdownChunker.chunkCode("   \n\n  ", "blank.md");
    expect(chunks).toHaveLength(0);
  });

  test("handles duplicate heading names", async () => {
    const content = `# FAQ

First FAQ section.

# FAQ

Second FAQ section.`;

    const chunks = await markdownChunker.chunkCode(content, "faq.md");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.symbolName).toBe("FAQ");
    expect(chunks[1]!.symbolName).toBe("FAQ_2");
  });

  test("sets correct line numbers", async () => {
    const content = `# First

Line 3.

# Second

Line 7.`;

    const chunks = await markdownChunker.chunkCode(content, "doc.md");
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[1]!.symbolName).toBe("Second");
    expect(chunks[1]!.startLine).toBe(5);
  });

  test("sets filePath on all chunks", async () => {
    const content = `# Section

Content.`;

    const chunks = await markdownChunker.chunkCode(content, "path/to/doc.md");
    for (const chunk of chunks) {
      expect(chunk.filePath).toBe("path/to/doc.md");
    }
  });

  test("mixed h1 and h2 headings", async () => {
    const content = `# Title

Intro.

## Section A

Content A.

## Section B

Content B.`;

    const chunks = await markdownChunker.chunkCode(content, "doc.md");
    expect(chunks).toHaveLength(3);
    expect(chunks[0]!.symbolName).toBe("Title");
    expect(chunks[1]!.symbolName).toBe("Section A");
    expect(chunks[2]!.symbolName).toBe("Section B");
  });
});
