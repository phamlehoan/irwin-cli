import env from "@configs/env";
import { createTransport, SendMailOptions, Transporter } from "nodemailer";
import { MailerAdapter } from "ts-rails";

/** Logs outbound mail as JSON (development / test). */
export class DevMailerAdapter implements MailerAdapter {
  private transporter: Transporter;
  private defaultFromAddress: string;

  constructor() {
    const JSONTransport = require("nodemailer/lib/json-transport");
    this.transporter = createTransport(new JSONTransport());
    const originalSend = this.transporter.sendMail.bind(this.transporter);
    this.transporter.sendMail = (options: SendMailOptions) => {
      console.info(
        "\x1b[35m[Mail Sent (test)]\x1b[0m",
        JSON.stringify(options, null, 2),
      );
      return originalSend(options);
    };
    this.defaultFromAddress = `Test Mailer <${env.emailFrom || env.mailUser || "noreply@localhost"}>`;
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail(options);
  }

  getDefaultFromAddress(): string {
    return this.defaultFromAddress;
  }
}
