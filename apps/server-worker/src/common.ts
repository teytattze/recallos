import { createCommonHttpApp } from "@repo/server-platform";

let isReady = false;

const commonHttpApp = createCommonHttpApp();
commonHttpApp.get("/api/v1/ready", (c) =>
  isReady ? c.json({ message: "ok" }) : c.json({ message: "not ready" }, 503),
);

const markWorkerReady = (): void => {
  isReady = true;
};

export { commonHttpApp, markWorkerReady };
