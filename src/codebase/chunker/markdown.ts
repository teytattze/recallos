import { marked } from "marked";
import { parse, type SgNode } from "@ast-grep/napi";
import type { Chunk } from "@/codebase/chunker/types";

const HEADING_TAGS = new Set(["h1", "h2"]);

function getTagName(element: SgNode): string | null {
  const startTag = element.children().find((c) => c.kind() === "start_tag");
  if (!startTag) return null;
  const tagName = startTag.children().find((c) => c.kind() === "tag_name");
  return tagName?.text() ?? null;
}

function getHeadingText(element: SgNode): string {
  // Get text content from the element (between start_tag and end_tag)
  const textNode = element.children().find((c) => c.kind() === "text");
  return textNode?.text().trim() ?? "_untitled";
}

function chunkCode(content: string, filePath: string): Chunk[] {
  const trimmed = content.trim();
  if (trimmed.length === 0) return [];

  const html = marked.parse(content) as string;
  const root = parse("html", html).root();
  const elements = root.children();
  const chunks: Chunk[] = [];

  // Find indices of heading elements (h1/h2)
  const headingIndices: number[] = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    if (el.kind() !== "element") continue;
    const tag = getTagName(el);
    if (tag && HEADING_TAGS.has(tag)) {
      headingIndices.push(i);
    }
  }

  // No headings — fallback to whole file
  if (headingIndices.length === 0) {
    const basename = filePath.split("/").pop() ?? filePath;
    return [
      {
        content: html,
        symbolName: basename,
        symbolKind: "file",
        filePath,
        startLine: 1,
        endLine: html.split("\n").length,
      },
    ];
  }

  const nameCount = new Map<string, number>();

  // Preamble: elements before the first heading
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

  // Extract sections: from each heading to the next heading (or EOF)
  for (let hi = 0; hi < headingIndices.length; hi++) {
    const headingIdx = headingIndices[hi]!;
    const headingEl = elements[headingIdx]!;
    const tag = getTagName(headingEl);
    const headingText = getHeadingText(headingEl);

    const count = nameCount.get(headingText) ?? 0;
    nameCount.set(headingText, count + 1);
    const finalName = count > 0 ? `${headingText}_${count + 1}` : headingText;

    const startIndex = headingEl.range().start.index;
    const startLine = headingEl.range().start.line + 1;

    let endIndex: number;
    let endLine: number;

    if (tag === "h1") {
      // For h1, stop at the next h2 or h1
      const nextHeadingIdx = headingIndices[hi + 1];
      if (nextHeadingIdx !== undefined) {
        const nextHeading = elements[nextHeadingIdx]!;
        endIndex = nextHeading.range().start.index;
        endLine = nextHeading.range().start.line;
      } else {
        endIndex = html.length;
        endLine = html.split("\n").length;
      }
    } else {
      // For h2, stop at the next h1 or h2
      const nextHeadingIdx = headingIndices[hi + 1];
      if (nextHeadingIdx !== undefined) {
        const nextHeading = elements[nextHeadingIdx]!;
        endIndex = nextHeading.range().start.index;
        endLine = nextHeading.range().start.line;
      } else {
        endIndex = html.length;
        endLine = html.split("\n").length;
      }
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
