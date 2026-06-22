import { expect, test } from "bun:test";

import { commonHttpApp, markWorkerReady } from "./common.ts";

test("worker readiness: given the change stream is not established and then becomes ready, it should preserve liveness and update readiness", async () => {
  // GIVEN / WHEN
  const livenessResponse = await commonHttpApp.request(
    "http://localhost/api/v1/health",
  );
  const initialReadinessResponse = await commonHttpApp.request(
    "http://localhost/api/v1/ready",
  );

  // THEN
  expect(livenessResponse.status).toBe(200);
  expect(await livenessResponse.json()).toEqual({ message: "ok" });
  expect(initialReadinessResponse.status).toBe(503);
  expect(await initialReadinessResponse.json()).toEqual({
    message: "not ready",
  });

  // WHEN
  markWorkerReady();
  const readyResponse = await commonHttpApp.request(
    "http://localhost/api/v1/ready",
  );

  // THEN
  expect(readyResponse.status).toBe(200);
  expect(await readyResponse.json()).toEqual({ message: "ok" });
});
