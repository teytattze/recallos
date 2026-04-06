import type z from "zod";

type MemoryAdapter<
  TReadInput,
  TReadOutput,
  TWriteInput,
  TWriteOutput,
> = {
  name: string;
  readInputSchema: z.ZodType<TReadInput>;
  readOutputSchema: z.ZodType<TReadOutput>;
  writeInputSchema: z.ZodType<TWriteInput>;
  writeOutputSchema: z.ZodType<TWriteOutput>;
  read(input: TReadInput): Promise<TReadOutput>;
  write(input: TWriteInput): Promise<TWriteOutput>;
  deleteChunks(ids: string[]): Promise<void>;
};

export type { MemoryAdapter };
