import z from "zod";
import { codeMemory } from "./code-memory";

// -- Code: Read --

const codeReadInputSchema = z.object({
  kind: z.literal("code").describe("The memory kind to read from"),
  queries: z
    .string()
    .array()
    .describe("The search queries provided by agent or user"),
});

const codeReadOutputSchema = z.object({
  kind: z.literal("code").describe("The memory kind that was read from"),
  queryOutputs: z
    .object({
      originalQuery: z
        .string()
        .describe("The original search query that produced these results"),
      results: z
        .object({
          id: z.string().describe("The unique ID of the code"),
          document: z
            .string()
            .describe("The actual document (content) of the search result"),
          filePath: z
            .string()
            .describe(
              "The relative file path location of the actual document (content)",
            ),
          symbolName: z
            .string()
            .describe("The name of the symbol (function, class, type, etc.)"),
          symbolKind: z
            .string()
            .describe(
              "The kind of symbol: function, class, interface, type, enum, variable, preamble, or file",
            ),
          startLine: z
            .number()
            .describe(
              "The starting line number of the symbol in the source file",
            ),
          endLine: z
            .number()
            .describe(
              "The ending line number of the symbol in the source file",
            ),
        })
        .array()
        .describe("The list of matching code results for this query"),
    })
    .array()
    .describe("The results grouped by each input query"),
});

// -- Code: Write --

const codeWriteInputSchema = z.object({
  kind: z.literal("code").describe("The memory kind to write to"),
  items: z
    .object({
      code: z.string().describe("The source code content to store in memory"),
      filePath: z
        .string()
        .describe("The relative file path of the source code"),
    })
    .array()
    .describe("The list of code items to write to memory"),
});

const codeWriteOutputSchema = z.object({
  kind: z.literal("code").describe("The memory kind that was written to"),
});

// -- Discriminated unions --

const readInputSchema = z.discriminatedUnion("kind", [codeReadInputSchema]);
const readOutputSchema = z.discriminatedUnion("kind", [codeReadOutputSchema]);
const writeInputSchema = z.discriminatedUnion("kind", [codeWriteInputSchema]);
const writeOutputSchema = z.discriminatedUnion("kind", [codeWriteOutputSchema]);

// -- Handlers --

async function read(
  input: z.infer<typeof readInputSchema>,
): Promise<z.infer<typeof readOutputSchema>> {
  switch (input.kind) {
    case "code": {
      const result = await codeMemory.read({ queries: input.queries });
      return {
        kind: "code",
        queryOutputs: input.queries.map((query, queryIndex) => ({
          originalQuery: query,
          results:
            result.ids[queryIndex]?.map((id, i) => ({
              id,
              document: result.documents[queryIndex]?.[i] ?? "",
              filePath: String(
                result.metadatas[queryIndex]?.[i]?.filePath ?? "",
              ),
              symbolName: String(
                result.metadatas[queryIndex]?.[i]?.symbolName ?? "",
              ),
              symbolKind: String(
                result.metadatas[queryIndex]?.[i]?.symbolKind ?? "",
              ),
              startLine: Number(
                result.metadatas[queryIndex]?.[i]?.startLine ?? 0,
              ),
              endLine: Number(result.metadatas[queryIndex]?.[i]?.endLine ?? 0),
            })) ?? [],
        })),
      };
    }
  }
}

async function write(
  input: z.infer<typeof writeInputSchema>,
): Promise<z.infer<typeof writeOutputSchema>> {
  switch (input.kind) {
    case "code": {
      await Promise.all(
        input.items.map((item) =>
          codeMemory.write({ code: item.code, filePath: item.filePath }),
        ),
      );
      return { kind: "code" };
    }
  }
}

const memoryManager = {
  read,
  readInputSchema,
  readOutputSchema,

  write,
  writeInputSchema,
  writeOutputSchema,
};

export { memoryManager };
