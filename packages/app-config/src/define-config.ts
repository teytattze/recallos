import type { PartialDeep } from "type-fest";

import { merge } from "es-toolkit";
import { z } from "zod";

import type { Env } from "./env";

type DeepUnknownify<T> = T extends object
  ? { [K in keyof T]: DeepUnknownify<T[K]> }
  : unknown;

type DefineConfigOptions<T extends z.ZodObject> = {
  schema: T;
  base: {
    local: PartialDeep<z.input<T>>;
    test: PartialDeep<z.input<T>>;
    staging: PartialDeep<z.input<T>>;
    production: PartialDeep<z.input<T>>;
  };
  runtime: DeepUnknownify<z.input<T>>;
};

const defineConfig =
  <T extends z.ZodObject>(input: DefineConfigOptions<T>) =>
  (activeEnv: Env) => {
    const { base, runtime, schema } = input;
    const activeBase = base[activeEnv];
    return schema.parse(merge(activeBase, runtime));
  };

export { defineConfig };
