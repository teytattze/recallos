import type { IamPrincipal } from "@repo/server-iam-core";
import type { Context } from "hono";

type IamContextVariables = {
  iamPrincipal: IamPrincipal;
};

type IamHonoEnv = {
  Variables: IamContextVariables;
};

const getIamPrincipal = (c: Context<IamHonoEnv>): IamPrincipal =>
  c.get("iamPrincipal");

const getIamTenant = (c: Context<IamHonoEnv>): string =>
  getIamPrincipal(c).tenant;

export { getIamPrincipal, getIamTenant };
export type { IamContextVariables, IamHonoEnv };
