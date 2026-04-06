import z from "zod";
import { codebaseMemory } from "@/memory/codebase";
import { docsMemory } from "@/memory/docs";
import { conversationMemory } from "@/memory/conversation";
import { knowledgeMemory } from "@/memory/knowledge";

// -- Discriminated unions --

const readInputSchema = z.discriminatedUnion("kind", [
  codebaseMemory.readInputSchema,
  docsMemory.readInputSchema,
  conversationMemory.readInputSchema,
  knowledgeMemory.readInputSchema,
]);

const readOutputSchema = z.discriminatedUnion("kind", [
  codebaseMemory.readOutputSchema,
  docsMemory.readOutputSchema,
  conversationMemory.readOutputSchema,
  knowledgeMemory.readOutputSchema,
]);

const writeInputSchema = z.discriminatedUnion("kind", [
  codebaseMemory.writeInputSchema,
  docsMemory.writeInputSchema,
  conversationMemory.writeInputSchema,
  knowledgeMemory.writeInputSchema,
]);

const writeOutputSchema = z.discriminatedUnion("kind", [
  codebaseMemory.writeOutputSchema,
  docsMemory.writeOutputSchema,
  conversationMemory.writeOutputSchema,
  knowledgeMemory.writeOutputSchema,
]);

// -- Handlers --

async function read(
  input: z.infer<typeof readInputSchema>,
): Promise<z.infer<typeof readOutputSchema>> {
  switch (input.kind) {
    case "codebase":
      return codebaseMemory.read(input);
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
    case "codebase":
      return codebaseMemory.write(input);
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
