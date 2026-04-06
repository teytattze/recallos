import z from "zod";
import { codeMemory } from "./code";
import { docsMemory } from "./docs";
import { conversationMemory } from "./conversation";
import { knowledgeMemory } from "./knowledge";

// -- Discriminated unions --

const readInputSchema = z.discriminatedUnion("kind", [
  codeMemory.readInputSchema,
  docsMemory.readInputSchema,
  conversationMemory.readInputSchema,
  knowledgeMemory.readInputSchema,
]);

const readOutputSchema = z.discriminatedUnion("kind", [
  codeMemory.readOutputSchema,
  docsMemory.readOutputSchema,
  conversationMemory.readOutputSchema,
  knowledgeMemory.readOutputSchema,
]);

const writeInputSchema = z.discriminatedUnion("kind", [
  codeMemory.writeInputSchema,
  docsMemory.writeInputSchema,
  conversationMemory.writeInputSchema,
  knowledgeMemory.writeInputSchema,
]);

const writeOutputSchema = z.discriminatedUnion("kind", [
  codeMemory.writeOutputSchema,
  docsMemory.writeOutputSchema,
  conversationMemory.writeOutputSchema,
  knowledgeMemory.writeOutputSchema,
]);

// -- Handlers --

async function read(
  input: z.infer<typeof readInputSchema>,
): Promise<z.infer<typeof readOutputSchema>> {
  switch (input.kind) {
    case "code":
      return codeMemory.read(input);
    case "docs":
      return docsMemory.read(input);
    case "conversation":
      return conversationMemory.read(input);
    case "knowledge":
      return knowledgeMemory.read(input);
  }
}

async function write(
  input: z.infer<typeof writeInputSchema>,
): Promise<z.infer<typeof writeOutputSchema>> {
  switch (input.kind) {
    case "code":
      return codeMemory.write(input);
    case "docs":
      return docsMemory.write(input);
    case "conversation":
      return conversationMemory.write(input);
    case "knowledge":
      return knowledgeMemory.write(input);
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
