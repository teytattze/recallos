import type { SignInStepProps } from "@/features/sign-in/sign-in-types";

import { Center } from "@/components/ui/center";
import { Pending } from "@/components/ui/pending";

function SignInEmailOtpVerifiedStep(_: SignInStepProps) {
  return (
    <Center>
      <Pending />
    </Center>
  );
}

export { SignInEmailOtpVerifiedStep };
