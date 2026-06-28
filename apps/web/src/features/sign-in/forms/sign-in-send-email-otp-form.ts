import { useForm } from "@tanstack/react-form";
import z from "zod";

const formDataSchema = z.object({
  email: z.email(),
});
type FormData = z.infer<typeof formDataSchema>;

const useSignInSendEmailOtpForm = (props: {
  onSubmit: (props: { value: FormData }) => Promise<void>;
}) =>
  useForm({
    defaultValues: { email: "" },
    formId: "sign-in-send-email-otp-form" as const,
    validators: { onSubmit: formDataSchema },
    onSubmit: props.onSubmit,
  });
type SignInSendEmailOtpForm = ReturnType<typeof useSignInSendEmailOtpForm>;

export { useSignInSendEmailOtpForm };
export type { SignInSendEmailOtpForm };
