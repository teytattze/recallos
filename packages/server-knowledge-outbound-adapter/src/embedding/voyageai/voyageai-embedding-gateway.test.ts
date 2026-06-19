import { afterEach, expect, mock, test } from "bun:test";

import { VoyageaiEmbeddingGateway } from "./voyageai-embedding-gateway.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("VoyageaiEmbeddingGateway.embed: given text, it should request and return its document embedding", async () => {
  // GIVEN
  const fetchMock = mock(() =>
    Promise.resolve(
      Response.json({
        data: [{ embedding: [1, 2], index: 0 }],
      }),
    ),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  const gateway = new VoyageaiEmbeddingGateway("test-api-key");

  // WHEN
  const result = await gateway.embed({
    dimension: "1024",
    model: "voyage-4-large",
    text: "event",
  });

  // THEN
  expect(result).toEqual({ embedding: [1, 2] });
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.voyageai.com/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer test-api-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: "event",
        input_type: "document",
        model: "voyage-4-large",
        output_dimension: 1024,
      }),
    },
  );
});

test("VoyageaiEmbeddingGateway.embed: given an unsuccessful response, it should throw the response status", async () => {
  // GIVEN
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(null, { status: 429 })),
  ) as unknown as typeof fetch;
  const gateway = new VoyageaiEmbeddingGateway("test-api-key");

  // WHEN / THEN
  expect(
    gateway.embed({
      dimension: "1024",
      model: "voyage-4-large",
      text: "event",
    }),
  ).rejects.toThrow("Voyage AI embedding request failed with status 429");
});
