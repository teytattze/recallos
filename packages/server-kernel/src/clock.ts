interface Clock {
  now(): Date;
}

function createFixedClock(at: Date): Clock {
  const instant = new Date(at.getTime());
  return {
    now: () => new Date(instant.getTime()),
  };
}

export { createFixedClock };
export type { Clock };
