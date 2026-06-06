type DomainErrorCategory =
  | "validation" // input rejected or an invariant refused the value
  | "not-found" // an expected entity was absent and the caller must handle it
  | "conflict" // uniqueness / concurrent-state violation
  | "forbidden" // a policy or authorization rule said no
  | "unexpected"; // last-resort fallback; prefer a `throw` for true faults

interface DomainError<TKind extends string> {
  readonly kind: TKind;
  readonly category: DomainErrorCategory;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Build a typed error factory for one domain error kind.
 */
function defineError<TKind extends string>(
  kind: TKind,
  category: DomainErrorCategory,
): (
  message: string,
  details?: Readonly<Record<string, unknown>>,
) => DomainError<TKind> {
  return (message, details) => ({
    kind,
    category,
    message,
    ...(details === undefined ? {} : { details }),
  });
}

export { defineError };
export type { DomainError, DomainErrorCategory };
