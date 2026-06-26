import { Resend } from "resend";

type SendOtpEmailInput = {
  readonly email: string;
  readonly otp: string;
  readonly type: string;
};

type ResendOtpEmailSenderInput = {
  readonly apiKey: string;
  readonly from: string;
};

class ResendOtpEmailSender {
  private readonly resend: Resend;

  constructor(private readonly input: ResendOtpEmailSenderInput) {
    this.resend = new Resend(input.apiKey);
  }

  async send(input: SendOtpEmailInput): Promise<void> {
    await this.resend.emails.send({
      from: this.input.from,
      to: input.email,
      subject: "Your RecallOS sign-in code",
      text: `Your RecallOS ${input.type} code is ${input.otp}.`,
    });
  }
}

export { ResendOtpEmailSender };
export type { ResendOtpEmailSenderInput, SendOtpEmailInput };
