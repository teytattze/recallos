import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Center } from "@/components/ui/center";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { withFormSubmitPreventDefault } from "@/libs/form/utils";
import type { SignInSendEmailOtpForm } from "@/features/sign-in/forms/sign-in-send-email-otp-form";
import type { SignInVerifyEmailOtpForm } from "@/features/sign-in/forms/sign-in-verify-email-otp-form";

type SignInVerifyEmailOtpStepProps = {
  sendEmailOtpForm: SignInSendEmailOtpForm;
  verifyEmailOtpForm: SignInVerifyEmailOtpForm;
  onBack: () => void;
};

function SignInVerifyEmailOtpStep(props: SignInVerifyEmailOtpStepProps) {
  const { onBack, sendEmailOtpForm, verifyEmailOtpForm } = props;

  return (
    <Center className="gap-y-2">
      <div className="flex items-center gap-x-1">
        <Button onClick={onBack} size="icon-xs" variant="ghost">
          <ArrowLeftIcon />
        </Button>
        <h1 className="text-base">Verify OTP</h1>
      </div>
      <form
        className="w-64"
        onSubmit={withFormSubmitPreventDefault(
          verifyEmailOtpForm.handleSubmit.bind(verifyEmailOtpForm),
        )}
      >
        <FieldGroup>
          <verifyEmailOtpForm.Field
            name="otp"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <sendEmailOtpForm.Subscribe
                    selector={(state) => state.values.email}
                    children={(email) => (
                      <FieldDescription>
                        Enter the verification code we sent to your email
                        address: {email}
                      </FieldDescription>
                    )}
                  />
                  <InputOTP
                    id={`${field.form._formId}-otp`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    aria-invalid={isInvalid}
                    maxLength={8}
                  >
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
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
          <Field>
            <ButtonGroup orientation="vertical">
              <Button type="submit" variant="secondary">
                Verify
              </Button>
              <Button onClick={sendEmailOtpForm.handleSubmit} variant="link">
                Resend
              </Button>
            </ButtonGroup>
          </Field>
        </FieldGroup>
      </form>
    </Center>
  );
}

export { SignInVerifyEmailOtpStep };
