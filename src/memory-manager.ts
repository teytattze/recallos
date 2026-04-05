import z from "zod";
import { codeMemory } from "./code-memory";

const memoryKind = ["code"] as const;
const memoryKindSchema = z
  .enum(memoryKind)
  .describe("The supported memory kind. Eg, code");

const readInputSchema = z.object({
  kind: memoryKindSchema,
  queries: z
    .string()
    .array()
    .describe("The search queries provided by agent or user"),
});

const readOutputSchema = z.object({
  kind: memoryKindSchema,
  queryOutputs: z
    .object({
      originalQuery: z.string(),
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
        })
        .array(),
    })
    .array(),
});

const writeInputSchema = z.object({
  kind: memoryKind,
  items: z
    .object({
      code: z.string(),
      filePath: z.string(),
    })
    .array(),
});

const writeOutputSchema = z.void();

const read = async (
  input: z.infer<typeof readInputSchema>,
): Promise<z.infer<typeof readOutputSchema>> => {
  const { kind, queries } = input;

  switch (kind) {
    case "code":
      const result = await codeMemory.read({ queries });
      return {
        kind: "code",
        queryOutputs: queries.map((query, queryIndex) => ({
          originalQuery: query,
          results:
            result.ids[queryIndex]?.map((id, i) => ({
              id,
              document: result.documents[queryIndex]?.[i] ?? "",
              filePath: result.metadatas[queryIndex]?.[i]?.filePath ?? "",
            })) ?? [],
        })),
      };
  }
};

const write = async (
  input: z.infer<typeof writeInputSchema>,
): Promise<z.infer<typeof writeOutputSchema>> => {
  const { kind, items } = input;

  switch (kind) {
    case "code":
      await Promise.all(
        items.map((item) =>
          codeMemory.write({ code: item.code, filePath: item.filePath }),
        ),
      );
      return;
  }
};

const memoryManager = {
  read,
  readInputSchema,
  readOutputSchema,

  write,
  writeInputSchema,
  writeOutputSchema,
};

export { memoryManager };
