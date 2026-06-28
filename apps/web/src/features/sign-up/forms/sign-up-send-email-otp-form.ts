import { useForm } from "@tanstack/react-form";
import z from "zod";

const formDataSchema = z.object({
  email: z.email(),
});
type FormData = z.infer<typeof formDataSchema>;

const useSignUpSendEmailOtpForm = (props: {
  onSubmit: (props: { value: FormData }) => Promise<void>;
}) =>
  useForm({
    defaultValues: { email: "" },
    formId: "sign-up-send-email-otp-form" as const,
    validators: { onSubmit: formDataSchema },
    onSubmit: props.onSubmit,
  });
type SignUpSendEmailOtpForm = ReturnType<typeof useSignUpSendEmailOtpForm>;

export { useSignUpSendEmailOtpForm };
export type { SignUpSendEmailOtpForm };
