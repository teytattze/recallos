import { z } from "zod";

const ingestionEventDocumentSchema = z.object({
  _id: z.string(),
  tenant: z.string(),
  graphId: z.string(),
  raw: z.record(z.string(), z.json()),
});

export { ingestionEventDocumentSchema };
