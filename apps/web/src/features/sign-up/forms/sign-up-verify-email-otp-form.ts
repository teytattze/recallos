import { useForm } from "@tanstack/react-form";
import z from "zod";

const formDataSchema = z.object({
  email: z.email(),
  otp: z.string().length(8),
});
type FormData = z.infer<typeof formDataSchema>;

const useSignUpVerifyEmailOtpForm = (props: {
  defaultValues: { email: FormData["email"] };
  onSubmit: (props: { value: FormData }) => Promise<void>;
}) =>
  useForm({
    defaultValues: {
      email: props.defaultValues.email,
      otp: "",
    },
    formId: "sign-up-verify-email-otp-form" as const,
    validators: {
      onSubmit: formDataSchema,
    },
    onSubmit: props.onSubmit,
  });
type SignUpVerifyEmailOtpForm = ReturnType<typeof useSignUpVerifyEmailOtpForm>;

export { useSignUpVerifyEmailOtpForm };
export type { SignUpVerifyEmailOtpForm };
