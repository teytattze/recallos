import { useSelector } from "@tanstack/react-store";
import { useState } from "react";

import { iamAuthDataHook } from "@/data/iam/iam-auth-data-hook";
import { useSignUpSendEmailOtpForm } from "@/features/sign-up/forms/sign-up-send-email-otp-form";
import { useSignUpVerifyEmailOtpForm } from "@/features/sign-up/forms/sign-up-verify-email-otp-form";
import { toast } from "sonner";
import { SignUpSendEmailOtpStep } from "@/features/sign-up/components/sign-up-send-email-otp-step";
import { SignUpVerifyEmailOtpStep } from "@/features/sign-up/components/sign-up-verify-email-otp-step";
import { SignUpEmailOtpVerifiedStep } from "@/features/sign-up/components/sign-up-email-otp-verified-step";

type StepKey = "send-email-otp" | "verify-email-otp" | "email-otp-verified";

function SignUpPage() {
  const [step, setStep] = useState<StepKey>("send-email-otp");

  const { mutateAsync: sendEmailOtp } = iamAuthDataHook.useSendEmailOtp();
  const { mutateAsync: verifyEmailOtp } = iamAuthDataHook.useVerifyEmailOtp();

  const handleVerifyEmailOtpStepBack = () => {
    setStep("send-email-otp");
  };

  const sendEmailOtpForm = useSignUpSendEmailOtpForm({
    onSubmit: async (props) => {
      try {
        await sendEmailOtp({ email: props.value.email });
        setStep("verify-email-otp");
      } catch {
        toast.error("Failed to send email OTP");
      }
    },
  });
  const email = useSelector(
    sendEmailOtpForm.store,
    (state) => state.values.email,
  );

  const verifyEmailOtpForm = useSignUpVerifyEmailOtpForm({
    defaultValues: { email },
    onSubmit: async (props) => {
      try {
        await verifyEmailOtp({
          email: props.value.email,
          otp: props.value.otp,
        });
        setStep("email-otp-verified");
      } catch {
        toast.error("Email OTP verification failed");
      }
    },
  });

  switch (step) {
    case "send-email-otp":
      return <SignUpSendEmailOtpStep form={sendEmailOtpForm} />;
    case "verify-email-otp":
      return (
        <SignUpVerifyEmailOtpStep
          onBack={handleVerifyEmailOtpStepBack}
          sendEmailOtpForm={sendEmailOtpForm}
          verifyEmailOtpForm={verifyEmailOtpForm}
        />
      );
    case "email-otp-verified":
      return <SignUpEmailOtpVerifiedStep redirectTo="/" />;
  }
}

export { SignUpPage };
