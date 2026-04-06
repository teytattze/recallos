import z from "zod";
import type { MemoryAdapter } from "./types";

const readInputSchema = z.object({
  kind: z.literal("conversation").describe("The memory kind to read from"),
  queries: z
    .string()
    .array()
    .describe("The search queries to find relevant conversations"),
});

const readOutputSchema = z.object({
  kind: z.literal("conversation").describe("The memory kind that was read from"),
  queryOutputs: z
    .object({
      originalQuery: z.string().describe("The original search query"),
      results: z
        .object({
          id: z.string().describe("The unique ID of the message"),
          content: z.string().describe("The message content"),
          role: z.string().describe("The role of the message sender"),
          timestamp: z.string().describe("The timestamp of the message"),
        })
        .array()
        .describe("The matching conversation results"),
    })
    .array()
    .describe("The results grouped by each input query"),
});

const writeInputSchema = z.object({
  kind: z.literal("conversation").describe("The memory kind to write to"),
  items: z
    .object({
      content: z.string().describe("The message content to store"),
      role: z.string().describe("The role of the message sender"),
    })
    .array()
    .describe("The list of conversation items to write"),
});

const writeOutputSchema = z.object({
  kind: z.literal("conversation").describe("The memory kind that was written to"),
});

type ReadInput = z.infer<typeof readInputSchema>;
type ReadOutput = z.infer<typeof readOutputSchema>;
type WriteInput = z.infer<typeof writeInputSchema>;
type WriteOutput = z.infer<typeof writeOutputSchema>;

async function read(_input: ReadInput): Promise<ReadOutput> {
  throw new Error("Conversation memory not implemented");
}

async function write(_input: WriteInput): Promise<WriteOutput> {
  throw new Error("Conversation memory not implemented");
}

async function deleteChunks(_ids: string[]): Promise<void> {
  throw new Error("Conversation memory not implemented");
}

const conversationMemory = {
  name: "conversation" as const,
  readInputSchema,
  readOutputSchema,
  writeInputSchema,
  writeOutputSchema,
  read,
  write,
  deleteChunks,
} satisfies MemoryAdapter<ReadInput, ReadOutput, WriteInput, WriteOutput>;

export { conversationMemory };
