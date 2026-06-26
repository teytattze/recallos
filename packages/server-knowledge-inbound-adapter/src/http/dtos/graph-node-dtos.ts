import { z } from "zod";

const graphPathParams = z.object({
  graphId: z.string().trim().min(1),
});

const listGraphNodesQueryParams = z.object({
  eventId: z.string().trim().min(1),
});

const searchGraphBody = z.object({
  query: z.string().trim().min(1),
});

export { graphPathParams, listGraphNodesQueryParams, searchGraphBody };
