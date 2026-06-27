import { useForm } from "@tanstack/react-form";
import React, { useState, type SubmitEventHandler } from "react";

import type { SignInStepProps } from "@/features/sign-in/sign-in-types";

import { iamAuthDataHook } from "@/data/iam/iam-auth-data-hook";
import { SignInEmailOtpVerifiedStep } from "@/features/sign-in/components/sign-in-email-otp-verified-step";
import { SignInSendEmailOtpStep } from "@/features/sign-in/components/sign-in-send-email-otp-step";
import { SignInVerifyEmailOtpStep } from "@/features/sign-in/components/sign-in-verify-email-otp-step";
import { signInSendEmailOtpFormOptions } from "@/features/sign-in/forms/sign-in-send-email-otp-form";
import { signInVerifyEmailOtpFormOptions } from "@/features/sign-in/forms/sign-in-verify-email-otp-form";

type StepKey = "send-email-otp" | "verify-email-otp" | "email-otp-verified";

const stepToNextStep = {
  "send-email-otp": "verify-email-otp",
  "verify-email-otp": "email-otp-verified",
  "email-otp-verified": null,
} as const satisfies Record<StepKey, StepKey | null>;

const stepToPrevStep = {
  "send-email-otp": null,
  "verify-email-otp": "send-email-otp",
  "email-otp-verified": null,
} as const satisfies Record<StepKey, StepKey | null>;

const stepToComponent = {
  "send-email-otp": SignInSendEmailOtpStep,
  "verify-email-otp": SignInVerifyEmailOtpStep,
  "email-otp-verified": SignInEmailOtpVerifiedStep,
} as const satisfies Record<StepKey, React.FC<SignInStepProps>>;

function SignInPage() {
  const [step, setStep] = useState<StepKey>("send-email-otp");

  const { mutateAsync: sendEmailOtp } = iamAuthDataHook.useSendEmailOtp();
  const { mutateAsync: verifyEmailOtp } = iamAuthDataHook.useVerifyEmailOtp();

  const moveToNextStep = async () => {
    setStep((currentStep) => stepToNextStep[currentStep] ?? currentStep);
  };
  const moveToPrevStep = async () => {
    setStep((currentStep) => stepToPrevStep[currentStep] ?? currentStep);
  };

  const hasNextStep = () => stepToNextStep[step] !== null;
  const hasPrevStep = () => stepToPrevStep[step] !== null;

  const sendEmailOtpForm = useForm({
    ...signInSendEmailOtpFormOptions,
    onSubmit: async (props) => {
      await sendEmailOtp({ email: props.value.email });
      moveToNextStep();
    },
  });

  const verifyEmailOtpForm = useForm({
    ...signInVerifyEmailOtpFormOptions,
    defaultValues: {
      ...signInVerifyEmailOtpFormOptions.defaultValues,
      email: sendEmailOtpForm.getFieldValue("email"),
    },
    onSubmit: async (props) => {
      await verifyEmailOtp({ email: props.value.email, otp: props.value.otp });
      moveToNextStep();
    },
  });

  const stepToHandleFormSubmit = {
    "send-email-otp": sendEmailOtpForm.handleSubmit,
    "verify-email-otp": verifyEmailOtpForm.handleSubmit,
    "email-otp-verified": () => Promise.resolve(),
  } as const satisfies Record<StepKey, () => Promise<void>>;

  const handleFormSubmit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    await stepToHandleFormSubmit[step]();
  };

  const StepComponent = stepToComponent["email-otp-verified"];

  return (
    <StepComponent
      hasNext={hasNextStep()}
      hasPrev={hasPrevStep()}
      onFormSubmit={handleFormSubmit}
      onPrev={moveToPrevStep}
    />
  );
}

export { SignInPage };
