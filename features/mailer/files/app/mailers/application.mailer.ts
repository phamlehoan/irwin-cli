import { appPath } from "@lib/utils/path";
import pug from "pug";
import type { Transporter } from "nodemailer";
import { RailsMailer } from "ts-rails";

export class ApplicationMailer extends RailsMailer {
  protected static async getTransporter(): Promise<{
    transporter: Transporter;
    from: string;
  }> {
    throw new Error(
      "Configure RailsApplication.mailerAdapter via irwin add mailer",
    );
  }

  protected static render(view: string, locals: Record<string, unknown>): string {
    const templatePath = appPath("views", `${view}.pug`);
    return pug.renderFile(templatePath, locals);
  }
}
