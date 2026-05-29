import { isMailDeliveryConfigured } from "@lib/utils/mailConfig";
import { PasswordType, UserStatus } from "@models/enums";
import {
  buildActivateAccountUrl,
  generateInviteToken,
} from "./authInvite.service";
import { ApplicationService } from "../application.service";
import { logger, Security, UnprocessableEntityError } from "ts-rails";

export type RegisterUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

async function sendAccountInviteEmail(
  email: string,
  firstName: string,
  lastName: string,
  activateLink: string,
): Promise<boolean> {
  try {
    const { UserMailer } = await import("@mailers/user.mailer");
    await UserMailer.accountInvite(email, firstName, lastName, activateLink);
    return true;
  } catch {
    return false;
  }
}

export class AuthRegisterService extends ApplicationService {
  async execute(input: RegisterUserInput): Promise<{
    email: string;
    activationRequired: boolean;
    emailSent: boolean;
  }> {
    const email = input.email.trim().toLowerCase();

    if (input.password !== input.passwordConfirmation) {
      throw new UnprocessableEntityError("PASSWORD_MISMATCH");
    }

    const existing = await this.models.user.findFirst({
      where: { email, deleted: false },
    });
    if (existing) {
      throw new UnprocessableEntityError("REGISTRATION_EMAIL_EXISTS");
    }

    const activationRequired = isMailDeliveryConfigured();
    const hashed = await Security.hashPassword(input.password);

    if (activationRequired) {
      const user = await this.models.user.create({
        data: {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email,
          status: UserStatus.PENDING,
          passwords: {
            create: {
              password: hashed,
              type: PasswordType.PASSWORD,
            },
          },
        },
      });

      const inviteToken = generateInviteToken(user.id);
      const activateLink = buildActivateAccountUrl(inviteToken);
      const emailSent = await sendAccountInviteEmail(
        user.email,
        user.firstName,
        user.lastName,
        activateLink,
      );

      return { email, activationRequired: true, emailSent };
    }

    await this.models.user.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        status: UserStatus.ACTIVE,
        passwords: {
          create: {
            password: hashed,
            type: PasswordType.PASSWORD,
          },
        },
      },
    });

    return { email, activationRequired: false, emailSent: false };
  }
}
