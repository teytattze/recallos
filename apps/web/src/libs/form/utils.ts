import type { SubmitEvent } from "react";

const withFormSubmitPreventDefault =
  <R>(fn: () => R) =>
  async <T extends Element>(e: SubmitEvent<T>) => {
    e.preventDefault();
    return await fn();
  };

export { withFormSubmitPreventDefault };
