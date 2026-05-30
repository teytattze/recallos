import { afterAll, beforeAll } from "bun:test";

import { startHarness, stopHarness } from "./harness/index.ts";

// Preloaded by bunfig.toml: these run once around the whole suite, so the Docker
// containers are started before the first test and torn down after the last.
beforeAll(startHarness);
afterAll(stopHarness);
