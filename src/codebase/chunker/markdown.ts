import { marked } from "marked";
import { parse, type SgNode } from "@ast-grep/napi";
import { deduplicateName, wholeFileChunk } from "@/codebase/chunker/util";
import type { Chunk } from "@/codebase/chunker/types";

const HEADING_TAGS = new Set(["h1", "h2"]);

function getTagName(element: SgNode): string | null {
  const startTag = element.children().find((c) => c.kind() === "start_tag");
  if (!startTag) return null;
  const tagName = startTag.children().find((c) => c.kind() === "tag_name");
  return tagName?.text() ?? null;
}

function getHeadingText(element: SgNode): string {
  const textNode = element.children().find((c) => c.kind() === "text");
  return textNode?.text().trim() ?? "_untitled";
}

function chunkCode(content: string, filePath: string): Chunk[] {
  const trimmed = content.trim();
  if (trimmed.length === 0) return [];

  const html = marked.parse(content) as string;
  const htmlLineCount = html.split("\n").length;
  const root = parse("html", html).root();
  const elements = root.children();
  const chunks: Chunk[] = [];

  const headingIndices: number[] = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    if (el.kind() !== "element") continue;
    const tag = getTagName(el);
    if (tag && HEADING_TAGS.has(tag)) {
      headingIndices.push(i);
    }
  }

  if (headingIndices.length === 0) {
    return [wholeFileChunk(html, filePath)];
  }

  const nameCount = new Map<string, number>();

  const firstHeadingIdx = headingIndices[0]!;
  if (firstHeadingIdx > 0) {
    const firstHeading = elements[firstHeadingIdx]!;
    const preambleContent = html
      .slice(0, firstHeading.range().start.index)
      .trim();
    if (preambleContent.length > 0) {
      chunks.push({
        content: preambleContent,
        symbolName: "_preamble",
        symbolKind: "preamble",
        filePath,
        startLine: 1,
        endLine: preambleContent.split("\n").length,
      });
    }
  }

  for (let hi = 0; hi < headingIndices.length; hi++) {
    const headingIdx = headingIndices[hi]!;
    const headingEl = elements[headingIdx]!;
    const headingText = getHeadingText(headingEl);
    const finalName = deduplicateName(nameCount, headingText);

    const headingRange = headingEl.range();
    const startIndex = headingRange.start.index;
    const startLine = headingRange.start.line + 1;

    let endIndex: number;
    let endLine: number;

    const nextHeadingIdx = headingIndices[hi + 1];
    if (nextHeadingIdx !== undefined) {
      const nextRange = elements[nextHeadingIdx]!.range();
      endIndex = nextRange.start.index;
      endLine = nextRange.start.line;
    } else {
      endIndex = html.length;
      endLine = htmlLineCount;
    }

    const sectionContent = html.slice(startIndex, endIndex);

    chunks.push({
      content: sectionContent,
      symbolName: finalName,
      symbolKind: "section",
      filePath,
      startLine,
      endLine,
    });
  }

  return chunks;
}

const markdownChunker = { chunkCode };

export { markdownChunker };
