/**
 * Coarse, domain-level semantics of a failure. This is *not* a transport
 * concern — it says what kind of failure happened in business terms. The
 * inbound adapter is what maps each category to a status code / retry policy,
 * so adapters never need to know every concrete `kind`.
 */
export type DomainErrorCategory =
  | "validation" // input rejected or an invariant refused the value
  | "not-found" // an expected entity was absent and the caller must handle it
  | "conflict" // uniqueness / concurrent-state violation
  | "forbidden" // a policy or authorization rule said no
  | "unexpected"; // last-resort fallback; prefer a `throw` for true faults

/**
 * The shape every expected failure carries. `kind` is a unique discriminant
 * (e.g. `"EmailInvalid"`) so a context can union its errors and `switch` over
 * them exhaustively; `category` lets boundaries route without knowing each kind.
 *
 * Define concrete errors as a tagged union, not a class hierarchy — see
 * {@link defineError}.
 */
export interface DomainError {
  readonly kind: string;
  readonly category: DomainErrorCategory;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Build a typed factory for one error kind. The returned `kind` is a literal,
 * so a context can form an exhaustive union from these factories:
 *
 * ```ts
 * const EmailInvalid = defineError("EmailInvalid", "validation");
 * const QuotaExceeded = defineError("QuotaExceeded", "conflict");
 *
 * type IngestError =
 *   | ReturnType<typeof EmailInvalid>
 *   | ReturnType<typeof QuotaExceeded>;
 * ```
 */
export function defineError<Kind extends string>(
  kind: Kind,
  category: DomainErrorCategory,
): (
  message: string,
  details?: Readonly<Record<string, unknown>>,
) => DomainError & { readonly kind: Kind } {
  return (message, details) => ({
    kind,
    category,
    message,
    ...(details === undefined ? {} : { details }),
  });
}
