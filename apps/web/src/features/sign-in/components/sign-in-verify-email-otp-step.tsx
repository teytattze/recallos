import { ArrowLeftIcon } from "lucide-react";

import type { SignInStepProps } from "@/features/sign-in/sign-in-types";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Center } from "@/components/ui/center";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

function SignInVerifyEmailOtpStep(props: SignInStepProps) {
  return (
    <Center className="gap-y-2">
      <div className="flex items-center gap-x-1">
        <Button size="icon-xs" variant="ghost">
          <ArrowLeftIcon />
        </Button>
        <h1 className="text-base">Verify OTP</h1>
      </div>
      <form className="w-64" onSubmit={props.onFormSubmit}>
        <FieldGroup>
          <Field>
            <FieldDescription>
              Enter the verification code we sent to your email address:
              m@example.com
            </FieldDescription>
            <InputOTP maxLength={8}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
                <InputOTPSlot index={6} />
                <InputOTPSlot index={7} />
              </InputOTPGroup>
            </InputOTP>
          </Field>
          <Field>
            <ButtonGroup orientation="vertical">
              <Button type="submit" variant="secondary">
                Verify
              </Button>
              <Button variant="link">Resend</Button>
            </ButtonGroup>
          </Field>
        </FieldGroup>
      </form>
    </Center>
  );
}

export { SignInVerifyEmailOtpStep };
