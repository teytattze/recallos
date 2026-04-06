import { Language, type Node, Parser } from "web-tree-sitter";
import type { Chunk } from "@/memory/chunker/types";
// @ts-expect-error -- Bun file embed, returns a path string
import parserWasmPath from "./wasm/web-tree-sitter.wasm" with { type: "file" };
// @ts-expect-error -- Bun file embed, returns a path string
import mdWasmPath from "./wasm/tree-sitter-markdown.wasm" with { type: "file" };

let parser: Parser | null = null;

async function getParser(): Promise<Parser> {
  if (parser) return parser;
  await Parser.init({
    locateFile: () => parserWasmPath,
  });
  const p = new Parser();
  const lang = await Language.load(mdWasmPath);
  p.setLanguage(lang);
  parser = p;
  return p;
}

function getHeadingLevel(section: Node): number | null {
  const heading = section.children.find((c) => c.type === "atx_heading");
  if (!heading) return null;
  for (const child of heading.children) {
    if (child.type === "atx_h1_marker") return 1;
    if (child.type === "atx_h2_marker") return 2;
  }
  return null;
}

function getHeadingText(section: Node): string {
  const heading = section.children.find((c) => c.type === "atx_heading");
  if (!heading) return "_untitled";
  const inline = heading.children.find((c) => c.type === "inline");
  return inline?.text.trim() ?? "_untitled";
}

/**
 * Recursively collect all h1/h2 sections from the tree.
 * In tree-sitter-markdown, h2 sections are nested inside h1 sections.
 */
function collectH1H2Sections(node: Node): Node[] {
  const results: Node[] = [];
  for (const child of node.children) {
    if (child.type === "section") {
      const level = getHeadingLevel(child);
      if (level === 1 || level === 2) {
        results.push(child);
        // Also check for nested h2 sections inside h1 sections
        if (level === 1) {
          for (const nested of child.children) {
            if (nested.type === "section") {
              const nestedLevel = getHeadingLevel(nested);
              if (nestedLevel === 2) {
                results.push(nested);
              }
            }
          }
        }
      }
    }
  }
  return results;
}

async function chunkCode(content: string, filePath: string): Promise<Chunk[]> {
  const p = await getParser();
  const tree = p.parse(content);

  if (tree === null) return [];

  const rootNode = tree.rootNode;
  const chunks: Chunk[] = [];

  const h1h2Sections = collectH1H2Sections(rootNode);

  if (h1h2Sections.length === 0) {
    // No h1/h2 headings — fallback to whole file
    const trimmed = content.trim();
    if (trimmed.length === 0) return [];
    const basename = filePath.split("/").pop() ?? filePath;
    return [
      {
        content,
        symbolName: basename,
        symbolKind: "file",
        filePath,
        startLine: 1,
        endLine: content.split("\n").length,
      },
    ];
  }

  // Check for preamble: content before the first h1/h2 section
  const firstSection = h1h2Sections[0]!;
  if (firstSection.startIndex > 0) {
    const preambleContent = content.slice(0, firstSection.startIndex).trim();
    if (preambleContent.length > 0) {
      const preambleLines = content.slice(0, firstSection.startIndex);
      const startLine = 1;
      // Count lines in preamble region
      const endLine = preambleLines.trimEnd().split("\n").length;
      chunks.push({
        content: preambleContent,
        symbolName: "_preamble",
        symbolKind: "preamble",
        filePath,
        startLine,
        endLine,
      });
    }
  }

  // Extract each h1/h2 section as a chunk
  // For h1 sections that contain h2 children, we need to calculate the content
  // that belongs to the h1 itself (before the first h2 child)
  const nameCount = new Map<string, number>();

  for (const section of h1h2Sections) {
    const level = getHeadingLevel(section);
    const headingText = getHeadingText(section);

    const count = nameCount.get(headingText) ?? 0;
    nameCount.set(headingText, count + 1);
    const finalName = count > 0 ? `${headingText}_${count + 1}` : headingText;

    let sectionContent: string;
    let endLine: number;

    if (level === 1) {
      // For h1, only include content up to the first nested h2 section
      const firstNestedH2 = section.children.find(
        (c) => c.type === "section" && getHeadingLevel(c) === 2,
      );
      if (firstNestedH2) {
        sectionContent = content.slice(section.startIndex, firstNestedH2.startIndex);
        endLine = firstNestedH2.startPosition.row; // Line before the h2
      } else {
        sectionContent = content.slice(section.startIndex, section.endIndex);
        endLine = section.endPosition.row + 1;
      }
    } else {
      sectionContent = content.slice(section.startIndex, section.endIndex);
      endLine = section.endPosition.row + 1;
    }

    chunks.push({
      content: sectionContent,
      symbolName: finalName,
      symbolKind: "section",
      filePath,
      startLine: section.startPosition.row + 1,
      endLine,
    });
  }

  return chunks;
}

const markdownChunker = { chunkCode };

export { markdownChunker };
