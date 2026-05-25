import env from "@configs/env";
import { RailsApplication } from "ts-rails";
import { DevMailerAdapter, SmtpMailerAdapter } from "../mail";

export function initializeMailer() {
  switch (env.mailService) {
    case "smtp":
      RailsApplication.mailerAdapter = new SmtpMailerAdapter();
      break;
    case "test":
      RailsApplication.mailerAdapter = new DevMailerAdapter();
      break;
    default:
      RailsApplication.loggerAdapter?.warn(
        `[Mailer] Unknown MAIL_SERVICE="${env.mailService}". Use test or smtp.`,
      );
  }
}
