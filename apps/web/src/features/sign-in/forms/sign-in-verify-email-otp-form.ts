import { useForm } from "@tanstack/react-form";
import z from "zod";

const formDataSchema = z.object({
  email: z.email(),
  otp: z.string().length(8),
});
type FormData = z.infer<typeof formDataSchema>;

const useSignInVerifyEmailOtpForm = (props: {
  defaultValues: { email: FormData["email"] };
  onSubmit: (props: { value: FormData }) => Promise<void>;
}) =>
  useForm({
    defaultValues: {
      email: props.defaultValues.email,
      otp: "",
    },
    formId: "sign-in-verify-email-otp-form" as const,
    validators: {
      onSubmit: formDataSchema,
    },
    onSubmit: props.onSubmit,
  });
type SignInVerifyEmailOtpForm = ReturnType<typeof useSignInVerifyEmailOtpForm>;

export { useSignInVerifyEmailOtpForm };
export type { SignInVerifyEmailOtpForm };
