import z from "zod";
import type { MemoryAdapter } from "@/memory/types";

const readInputSchema = z.object({
  kind: z.literal("knowledge").describe("The memory kind to read from"),
  queries: z
    .string()
    .array()
    .describe("The search queries to find relevant knowledge entries"),
});

const readOutputSchema = z.object({
  kind: z.literal("knowledge").describe("The memory kind that was read from"),
  queryOutputs: z
    .object({
      originalQuery: z.string().describe("The original search query"),
      results: z
        .object({
          id: z.string().describe("The unique ID of the knowledge entry"),
          key: z.string().describe("The key of the knowledge entry"),
          value: z.string().describe("The value of the knowledge entry"),
          category: z.string().describe("The category of the knowledge entry"),
        })
        .array()
        .describe("The matching knowledge results"),
    })
    .array()
    .describe("The results grouped by each input query"),
});

const writeInputSchema = z.object({
  kind: z.literal("knowledge").describe("The memory kind to write to"),
  items: z
    .object({
      key: z.string().describe("The key for the knowledge entry"),
      value: z.string().describe("The value for the knowledge entry"),
      category: z.string().describe("The category for the knowledge entry"),
    })
    .array()
    .describe("The list of knowledge items to write"),
});

const writeOutputSchema = z.object({
  kind: z.literal("knowledge").describe("The memory kind that was written to"),
});

type ReadInput = z.infer<typeof readInputSchema>;
type ReadOutput = z.infer<typeof readOutputSchema>;
type WriteInput = z.infer<typeof writeInputSchema>;
type WriteOutput = z.infer<typeof writeOutputSchema>;

async function read(_input: ReadInput): Promise<ReadOutput> {
  throw new Error("Knowledge memory not implemented");
}

async function write(_input: WriteInput): Promise<WriteOutput> {
  throw new Error("Knowledge memory not implemented");
}

async function deleteChunks(_ids: string[]): Promise<void> {
  throw new Error("Knowledge memory not implemented");
}

const knowledgeMemory = {
  name: "knowledge" as const,
  readInputSchema,
  readOutputSchema,
  writeInputSchema,
  writeOutputSchema,
  read,
  write,
  deleteChunks,
} satisfies MemoryAdapter<ReadInput, ReadOutput, WriteInput, WriteOutput>;

export { knowledgeMemory };
