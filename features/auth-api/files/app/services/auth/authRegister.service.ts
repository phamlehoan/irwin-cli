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
  middleName?: string | null;
  email: string;
  password: string;
  passwordConfirmation: string;
};

export type RegisterUserResult = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    status: string;
  };
  status: string;
  activationRequired: boolean;
  emailSent: boolean;
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
  } catch (err) {
    logger.error(
      { err: String(err), email },
      "[AuthRegisterService] Failed to send activation email",
    );
    return false;
  }
}

export class AuthRegisterService extends ApplicationService {
  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    const email = input.email.trim().toLowerCase();
    const activationRequired = isMailDeliveryConfigured();

    if (input.password !== input.passwordConfirmation) {
      throw new UnprocessableEntityError("PASSWORD_MISMATCH");
    }

    const existing = await this.models.user.findFirst({
      where: { email, deleted: false },
    });
    if (existing) {
      throw new UnprocessableEntityError("REGISTRATION_EMAIL_EXISTS");
    }

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const middleName = input.middleName?.trim() || null;

    if (activationRequired) {
      const hashed = await Security.hashPassword(input.password);
      const user = await this.models.user.create({
        data: {
          firstName,
          lastName,
          middleName,
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

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          middleName: user.middleName,
          status: user.status,
        },
        status: user.status,
        activationRequired: true,
        emailSent,
      };
    }

    const hashed = await Security.hashPassword(input.password);
    const user = await this.models.user.create({
      data: {
        firstName,
        lastName,
        middleName,
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

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        status: user.status,
      },
      status: user.status,
      activationRequired: false,
      emailSent: false,
    };
  }
}
