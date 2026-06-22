import { z } from "zod";

const listGraphNodesPathParams = z.object({
  graphId: z.string().trim().min(1),
});

const listGraphNodesQueryParams = z.object({
  eventId: z.string().trim().min(1),
  tenant: z.string().trim().min(1),
});

export { listGraphNodesPathParams, listGraphNodesQueryParams };
