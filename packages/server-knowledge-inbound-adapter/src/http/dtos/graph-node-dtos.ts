import { z } from "zod";

const graphNodeByEventIdPathParams = z.object({
  eventId: z.string().trim().min(1),
});

const graphNodeByEventIdQueryParams = z.object({
  tenant: z.string().trim().min(1),
});

export { graphNodeByEventIdPathParams, graphNodeByEventIdQueryParams };
