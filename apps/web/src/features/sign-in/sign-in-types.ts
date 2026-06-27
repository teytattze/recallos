import type { SubmitEventHandler } from "react";

type SignInStepProps = {
  onFormSubmit: SubmitEventHandler<HTMLFormElement>;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
};

export type { SignInStepProps };
