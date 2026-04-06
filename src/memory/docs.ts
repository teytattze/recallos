import z from "zod";
import type { MemoryAdapter } from "@/memory/types";

const readInputSchema = z.object({
  kind: z.literal("docs").describe("The memory kind to read from"),
  queries: z
    .string()
    .array()
    .describe("The search queries to find relevant documentation"),
});

const readOutputSchema = z.object({
  kind: z.literal("docs").describe("The memory kind that was read from"),
  queryOutputs: z
    .object({
      originalQuery: z.string().describe("The original search query"),
      results: z
        .object({
          id: z.string().describe("The unique ID of the document chunk"),
          document: z.string().describe("The document content"),
          filePath: z.string().describe("The file path of the document"),
          heading: z.string().describe("The section heading"),
          startLine: z.number().describe("The starting line number"),
          endLine: z.number().describe("The ending line number"),
        })
        .array()
        .describe("The matching document results"),
    })
    .array()
    .describe("The results grouped by each input query"),
});

const writeInputSchema = z.object({
  kind: z.literal("docs").describe("The memory kind to write to"),
  items: z
    .object({
      content: z.string().describe("The document content to store"),
      filePath: z.string().describe("The file path of the document"),
    })
    .array()
    .describe("The list of document items to write"),
});

const writeOutputSchema = z.object({
  kind: z.literal("docs").describe("The memory kind that was written to"),
});

type ReadInput = z.infer<typeof readInputSchema>;
type ReadOutput = z.infer<typeof readOutputSchema>;
type WriteInput = z.infer<typeof writeInputSchema>;
type WriteOutput = z.infer<typeof writeOutputSchema>;

async function read(_input: ReadInput): Promise<ReadOutput> {
  throw new Error("Docs memory not implemented");
}

async function write(_input: WriteInput): Promise<WriteOutput> {
  throw new Error("Docs memory not implemented");
}

async function deleteChunks(_ids: string[]): Promise<void> {
  throw new Error("Docs memory not implemented");
}

const docsMemory = {
  name: "docs" as const,
  readInputSchema,
  readOutputSchema,
  writeInputSchema,
  writeOutputSchema,
  read,
  write,
  deleteChunks,
} satisfies MemoryAdapter<ReadInput, ReadOutput, WriteInput, WriteOutput>;

export { docsMemory };
