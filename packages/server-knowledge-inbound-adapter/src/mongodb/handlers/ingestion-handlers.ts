import type { ProcessEventPort } from "@repo/server-knowledge-core";

import { ingestionEventDocumentSchema } from "../dtos/ingestion-event-dtos.ts";

type HandleIngestionInsertInput = {
  document: unknown;
  processEvent: ProcessEventPort;
};

const handleIngestionInsert = async (
  input: HandleIngestionInsertInput,
): Promise<void> => {
  const event = ingestionEventDocumentSchema.parse(input.document);

  await input.processEvent.execute({
    tenant: event.tenant,
    payload: {
      event: { id: event._id, raw: event.raw },
      graphId: event.graphId,
    },
  });
};

export { handleIngestionInsert };
