import { merge } from "es-toolkit";
import z, { ZodError } from "zod";

import {
  appErrorCodeToDefinition,
  isAppErrorCode,
  type AppErrorCode,
  type AppErrorDefinition,
} from "./app-error-details";

const appErrorJson = z.object({
  code: z.string().refine(isAppErrorCode),
  message: z.string().optional(),
});
type AppErrorJson = z.infer<typeof appErrorJson>;

type OfCodeOptions = {
  cause?: unknown;
  message?: string;
};

class AppError extends Error {
  #code: AppErrorCode;
  #definition: AppErrorDefinition;

  private constructor(
    code: AppErrorCode,
    definition: AppErrorDefinition,
    options: ErrorOptions,
  ) {
    super(definition.message, options);
    this.#code = code;
    this.#definition = definition;
  }

  static ofCode(code: AppErrorCode, options?: OfCodeOptions) {
    const { cause, message } = options ?? {};
    const definition = appErrorCodeToDefinition[code];
    const updatedDefinition = merge(definition, { message });
    return new AppError(code, updatedDefinition, { cause });
  }

  static from(error: unknown) {
    if (isAppErrorCode(error)) {
      return AppError.ofCode(error);
    }

    if (error instanceof AppError) {
      return error;
    }
    if (error instanceof ZodError) {
      return AppError.ofCode("invariantViolation", {
        cause: error,
      });
    }

    const result = appErrorJson.safeParse(error);
    if (result.success) {
      return AppError.ofCode(result.data.code, {
        message: result.data.message,
      });
    }

    return AppError.ofCode("unknown");
  }

  toJSON() {
    return {
      code: this.#code,
      message: this.message,
    } as const satisfies AppErrorJson;
  }

  get code() {
    return this.#code;
  }
  get httpStatus() {
    return this.#definition.mappings.httpStatus;
  }
}

export { AppError };
export type { AppErrorCode };
