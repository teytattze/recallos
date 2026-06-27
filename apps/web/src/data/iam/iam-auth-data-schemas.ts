import z from "zod";

const iamAuthSendEmailOtpInputSchema = z.object({
  email: z.email(),
});
type IamAuthSendEmailOtpInput = z.infer<typeof iamAuthSendEmailOtpInputSchema>;

const iamAuthVerifyEmailOtpInput = z.object({
  email: z.email(),
  otp: z.string(),
});
type IamAuthVerifyEmailOtpInput = z.infer<typeof iamAuthVerifyEmailOtpInput>;

export { iamAuthSendEmailOtpInputSchema, iamAuthVerifyEmailOtpInput };
export type { IamAuthSendEmailOtpInput, IamAuthVerifyEmailOtpInput };
