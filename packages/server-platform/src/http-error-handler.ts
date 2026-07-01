import type { ErrorHandler } from "hono";

import { AppError } from "@repo/app-error";

const createHttpErrorHandler = (): ErrorHandler => {
  return (error, c) => {
    const appError = AppError.from(error);
    return c.json(appError.toJSON(), appError.httpStatus);
  };
};

export { createHttpErrorHandler };
