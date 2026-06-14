interface Clock {
  now(): Date;
}

function createDefaultClock(): Clock {
  const instant = new Date();
  return {
    now: () => new Date(instant.getTime()),
  };
}

function createFixedClock(at: Date): Clock {
  const instant = new Date(at.getTime());
  return {
    now: () => new Date(instant.getTime()),
  };
}

export { createDefaultClock, createFixedClock };
export type { Clock };
