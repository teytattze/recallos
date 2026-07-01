import type { SignUpSendEmailOtpForm } from "@/features/sign-up/forms/sign-up-send-email-otp-form";

import { Center } from "@/components/extended-ui/center";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { withFormSubmitPreventDefault } from "@/libs/form/utils";

type SignUpSendEmailOtpStepProps = {
  form: SignUpSendEmailOtpForm;
};

function SignUpSendEmailOtpStep(props: SignUpSendEmailOtpStepProps) {
  const { form } = props;

  return (
    <Center className="gap-y-2">
      <div>
        <h1 className="text-base">Sign Up</h1>
      </div>
      <form
        className="w-64"
        onSubmit={withFormSubmitPreventDefault(form.handleSubmit.bind(form))}
      >
        <FieldGroup>
          <form.Field
            name="email"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <Input
                    id={`${field.form._formId}-email`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="Enter your email..."
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
          <Field>
            <Button type="submit" variant="secondary">
              Send OTP
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </Center>
  );
}

export { SignUpSendEmailOtpStep };
