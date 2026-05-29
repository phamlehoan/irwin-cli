import { ApplicationMailer } from "./application.mailer";

export class UserMailer extends ApplicationMailer {
  static async accountInvite(
    to: string,
    firstName: string,
    lastName: string,
    activateLink: string,
  ): Promise<void> {
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    await this.deliver({
      to,
      subject: "Activate your account",
      html: this.render("user.mailer/account_invite", {
        fullName,
        to,
        activateLink,
      }),
    });
  }
}
