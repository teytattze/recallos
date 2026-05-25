/**
 * A source of "now". Reading the wall clock is I/O, so the pure core never calls
 * `new Date()` or `Date.now()` directly — it depends on this port and an adapter
 * supplies the real clock at the composition root. The concrete OS-backed
 * implementation lives in infrastructure, not here.
 */
export interface Clock {
  now(): Date;
}

/**
 * A deterministic clock pinned to a fixed instant. Pure (no I/O), so it lives in
 * the kernel for use in domain and application tests where time must not vary.
 *
 * ```ts
 * const clock = fixedClock(new Date("2026-01-01T00:00:00Z"));
 * ```
 */
export function fixedClock(at: Date): Clock {
  const instant = new Date(at.getTime());
  return {
    now: () => new Date(instant.getTime()),
  };
}
