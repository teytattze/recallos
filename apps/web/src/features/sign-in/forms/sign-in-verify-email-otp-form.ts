import { formOptions } from "@tanstack/react-form";
import z from "zod";

const formSchema = z.object({
  email: z.email(),
  otp: z.string().length(8),
});

const signInVerifyEmailOtpFormOptions = formOptions({
  defaultValues: {
    email: "",
    otp: "",
  },
  formId: "sign-in-verify-email-otp-form" as const,
  validators: {
    onSubmit: formSchema,
  },
});

export { signInVerifyEmailOtpFormOptions };
