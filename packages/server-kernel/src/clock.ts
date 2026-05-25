/**
 * A source of "now". Reading the wall clock is I/O, so the pure core depends on
 * this port and an adapter supplies the real clock at the composition root.
 */
export interface Clock {
  now(): Date;
}

/**
 * A deterministic clock pinned to a fixed instant. Pure, so it lives in the
 * kernel for domain/application tests where time must not vary.
 */
export function fixedClock(at: Date): Clock {
  const instant = new Date(at.getTime());
  return {
    now: () => new Date(instant.getTime()),
  };
}
