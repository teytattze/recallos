import { useSelector } from "@tanstack/react-store";
import { useState } from "react";

import { iamAuthDataHook } from "@/data/iam/iam-auth-data-hook";
import { SignInEmailOtpVerifiedStep } from "@/features/sign-in/components/sign-in-email-otp-verified-step";
import { SignInSendEmailOtpStep } from "@/features/sign-in/components/sign-in-send-email-otp-step";
import { SignInVerifyEmailOtpStep } from "@/features/sign-in/components/sign-in-verify-email-otp-step";
import { useSignInSendEmailOtpForm } from "@/features/sign-in/forms/sign-in-send-email-otp-form";
import { useSignInVerifyEmailOtpForm } from "@/features/sign-in/forms/sign-in-verify-email-otp-form";
import { toast } from "sonner";

type StepKey = "send-email-otp" | "verify-email-otp" | "email-otp-verified";

function SignInPage() {
  const [step, setStep] = useState<StepKey>("send-email-otp");

  const { mutateAsync: sendEmailOtp } = iamAuthDataHook.useSendEmailOtp();
  const { mutateAsync: verifyEmailOtp } = iamAuthDataHook.useVerifyEmailOtp();

  const handleVerifyEmailOtpStepBack = () => {
    setStep("send-email-otp");
  };

  const sendEmailOtpForm = useSignInSendEmailOtpForm({
    onSubmit: async (props) => {
      try {
        await sendEmailOtp({ email: props.value.email });
        setStep("verify-email-otp");
      } catch (error) {
        toast.error("Failed to send email OTP");
      }
    },
  });
  const email = useSelector(
    sendEmailOtpForm.store,
    (state) => state.values.email,
  );

  const verifyEmailOtpForm = useSignInVerifyEmailOtpForm({
    defaultValues: { email },
    onSubmit: async (props) => {
      try {
        await verifyEmailOtp({
          email: props.value.email,
          otp: props.value.otp,
        });
        setStep("email-otp-verified");
      } catch (error) {
        toast.error("Email OTP verification failed");
      }
    },
  });

  switch (step) {
    case "send-email-otp":
      return <SignInSendEmailOtpStep form={sendEmailOtpForm} />;
    case "verify-email-otp":
      return (
        <SignInVerifyEmailOtpStep
          onBack={handleVerifyEmailOtpStepBack}
          sendEmailOtpForm={sendEmailOtpForm}
          verifyEmailOtpForm={verifyEmailOtpForm}
        />
      );
    case "email-otp-verified":
      return <SignInEmailOtpVerifiedStep redirectTo="/" />;
  }
}

export { SignInPage };
