import { generateToken } from "@lib";
import { PasswordType, UserStatus } from "@models/enums";
import { Prisma } from "@db";
import { Security, UnauthorizedError } from "ts-rails";
import { ApplicationService } from "../application.service";

export class AuthLoginService extends ApplicationService {
  async execute(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Record<string, unknown>;
  }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.models.user.findFirst({
      where: { email: normalized, deleted: false },
      include: {
        passwords: {
          where: { deleted: false, type: PasswordType.PASSWORD },
          orderBy: { createdAt: Prisma.SortOrder.desc },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }
    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedError("ACCOUNT_PENDING_ACTIVATION");
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError("Invalid email or password");
    }
    if (
      user.passwords.length === 0 ||
      !(await Security.verifyPassword(password, user.passwords[0]!.password))
    ) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const accessToken = generateToken({ id: user.id }, "1h");
    const refreshToken = generateToken({ id: user.id }, "7d");

    await this.models.$transaction([
      this.models.password.deleteMany({
        where: { userId: user.id, type: PasswordType.REFRESH_TOKEN },
      }),
      this.models.password.create({
        data: {
          userId: user.id,
          password: refreshToken,
          type: PasswordType.REFRESH_TOKEN,
        },
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        address: user.address,
        avatarUrl: user.avatarUrl,
        status: user.status,
        fullName: `${user.firstName} ${user.lastName}`,
      },
    };
  }
}
