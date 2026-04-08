import { marked } from "marked";
import type { SgNode } from "@ast-grep/napi";
import { deduplicateName, wholeFileChunk } from "@/codebase/chunker/util";
import type { LanguageAdapter } from "@/codebase/chunker/types";

function getHeadingText(element: SgNode): string {
  const textNode = element.children().find((c) => c.kind() === "text");
  return textNode?.text().trim() ?? "_untitled";
}

const markdownAdapter: LanguageAdapter = {
  lang: "html",
  extensions: [".md", ".mdx"],

  preprocess: (content) => marked.parse(content) as string,

  symbolRule: {
    rule: {
      kind: "element",
      has: {
        kind: "start_tag",
        has: { kind: "tag_name", regex: "^h[12]$" },
      },
    },
  },

  getSymbolName(node) {
    return getHeadingText(node);
  },

  getSymbolKind() {
    return "section";
  },

  postProcess(headingNodes, html, filePath) {
    const chunks = [];
    const nameCount = new Map<string, number>();
    const htmlLineCount = html.split("\n").length;

    // Preamble: content before first heading
    if (headingNodes.length > 0) {
      const firstRange = headingNodes[0]!.range();
      const preamble = html.slice(0, firstRange.start.index).trim();
      if (preamble.length > 0) {
        chunks.push({
          content: preamble,
          symbolName: "_preamble",
          symbolKind: "preamble",
          filePath,
          startLine: 1,
          endLine: preamble.split("\n").length,
        });
      }
    }

    // Sections: each heading spans until the next heading (or EOF)
    for (let i = 0; i < headingNodes.length; i++) {
      const node = headingNodes[i]!;
      const startIndex = node.range().start.index;
      const startLine = node.range().start.line + 1;
      const endIndex = headingNodes[i + 1]?.range().start.index ?? html.length;
      const endLine = headingNodes[i + 1]?.range().start.line ?? htmlLineCount;

      const headingText = getHeadingText(node);
      const name = deduplicateName(nameCount, headingText);

      chunks.push({
        content: html.slice(startIndex, endIndex),
        symbolName: name,
        symbolKind: "section",
        filePath,
        startLine,
        endLine,
      });
    }

    if (chunks.length === 0 && html.trim().length > 0) {
      return [wholeFileChunk(html, filePath)];
    }

    return chunks;
  },
};

export { markdownAdapter };
