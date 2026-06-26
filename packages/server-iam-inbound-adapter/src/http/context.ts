import type { Principal } from "@repo/server-iam-core";
import type { Context } from "hono";

type ContextVariables = {
  principal: Principal;
};

type HonoEnv = {
  Variables: ContextVariables;
};

const getPrincipal = (c: Context<HonoEnv>): Principal => c.get("principal");

const getTenant = (c: Context<HonoEnv>): string => getPrincipal(c).tenant;

export { getPrincipal, getTenant };
export type { ContextVariables, HonoEnv };
