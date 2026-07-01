import z from "zod";

import {
  appErrorCodeToDefinition,
  isAppErrorCode,
  type AppErrorCode,
  type AppErrorDefinition,
} from "./app-error-details";

const appErrorJson = z.object({
  code: z.string().refine(isAppErrorCode),
  details: z.record(z.string(), z.unknown()).optional(),
  message: z.string().optional(),
});
type AppErrorJson = z.infer<typeof appErrorJson>;

type OfCodeOptions = {
  cause?: unknown;
  details?: Readonly<Record<string, unknown>>;
  message?: string;
};

class AppError extends Error {
  #code: AppErrorCode;
  #definition: AppErrorDefinition;
  #details: Readonly<Record<string, unknown>> | undefined;

  private constructor(
    code: AppErrorCode,
    definition: AppErrorDefinition,
    options: ErrorOptions & {
      readonly details?: Readonly<Record<string, unknown>>;
      readonly message?: string;
    },
  ) {
    super(options.message ?? definition.message, options);
    this.#code = code;
    this.#definition = definition;
    this.#details = options.details;
  }

  static ofCode(code: AppErrorCode, options?: OfCodeOptions) {
    const { cause, details, message } = options ?? {};
    const definition = appErrorCodeToDefinition[code];
    return new AppError(code, definition, { cause, details, message });
  }

  static from(error: unknown) {
    if (error instanceof AppError) {
      return error;
    }
    if (isAppErrorCode(error)) {
      return AppError.ofCode(error);
    }
    const result = appErrorJson.safeParse(error);

    if (result.success) {
      return AppError.ofCode(result.data.code, {
        details: result.data.details,
        message: result.data.message,
      });
    }
    return AppError.ofCode("unknown");
  }

  toJSON() {
    return {
      code: this.#code,
      ...(this.#details === undefined ? {} : { details: this.#details }),
      message: this.message,
    } as const satisfies AppErrorJson;
  }

  get code() {
    return this.#code;
  }

  get details() {
    return this.#details;
  }

  get httpStatus() {
    return this.#definition.mappings.httpStatus;
  }

  get publicMessage() {
    return this.#definition.message;
  }
}

export { AppError };
export type { AppErrorCode };
