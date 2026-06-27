import { formOptions } from "@tanstack/react-form";
import z from "zod";

const signInSendEmailOtpFormOptions = formOptions({
  defaultValues: {
    email: "",
  },
  formId: "sign-in-send-email-otp-form" as const,
  validators: {
    onSubmit: z.object({
      email: z.email(),
    }),
  },
});

export { signInSendEmailOtpFormOptions };
