/**
 * Domain-level semantics of a failure, *not* a transport concern. The inbound
 * adapter maps each category to a status code / retry policy, so it never needs
 * to know every concrete `kind`.
 */
export type DomainErrorCategory =
  | "validation" // input rejected or an invariant refused the value
  | "not-found" // an expected entity was absent and the caller must handle it
  | "conflict" // uniqueness / concurrent-state violation
  | "forbidden" // a policy or authorization rule said no
  | "unexpected"; // last-resort fallback; prefer a `throw` for true faults

/**
 * The shape every expected failure carries. `kind` is a unique discriminant for
 * exhaustive `switch`ing within a context; `category` lets boundaries route
 * without knowing each kind. Define concrete errors as a tagged union via
 * {@link defineError}, not a class hierarchy.
 */
export interface DomainError {
  readonly kind: string;
  readonly category: DomainErrorCategory;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Build a typed factory for one error kind. The returned `kind` is a literal, so
 * a context can form an exhaustive union from these factories.
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
