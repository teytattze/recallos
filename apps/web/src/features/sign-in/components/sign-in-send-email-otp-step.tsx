import type { SignInStepProps } from "@/features/sign-in/sign-in-types";

import { Button } from "@/components/ui/button";
import { Center } from "@/components/ui/center";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function SignInSendEmailOtpStep(props: SignInStepProps) {
  return (
    <Center className="gap-y-2">
      <div>
        <h1 className="text-base">Sign In</h1>
      </div>
      <form className="w-64" onSubmit={props.onFormSubmit}>
        <FieldGroup>
          <Field>
            <Input placeholder="Enter your email..." />
          </Field>
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

export { SignInSendEmailOtpStep };
