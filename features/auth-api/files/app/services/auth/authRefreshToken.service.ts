import { generateToken, verifyToken } from "@lib";
import { PasswordType, UserStatus } from "@models/enums";
import { UnauthorizedError } from "ts-rails";
import { ApplicationService } from "../application.service";

export class AuthRefreshTokenService extends ApplicationService {
  async execute(refreshToken: string) {
    const decoded = verifyToken(refreshToken);
    const userId = decoded.id;
    if (!userId) {
      throw new UnauthorizedError("Refresh token is not valid.");
    }

    const storedToken = await this.models.password.findFirst({
      where: {
        userId,
        password: refreshToken,
        type: PasswordType.REFRESH_TOKEN,
        deleted: false,
      },
      include: { user: true },
    });

    if (!storedToken?.user) {
      throw new UnauthorizedError(
        "Refresh token is not valid or has been revoked.",
      );
    }

    const user = storedToken.user;
    if (user.deleted || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError(
        "Refresh token is not valid or has been revoked.",
      );
    }

    const newAccessToken = generateToken({ id: user.id }, "1h");
    const newRefreshToken = generateToken({ id: user.id }, "7d");

    await this.models.$transaction([
      this.models.password.delete({ where: { id: storedToken.id } }),
      this.models.password.create({
        data: {
          userId: user.id,
          password: newRefreshToken,
          type: PasswordType.REFRESH_TOKEN,
        },
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
      },
    };
  }
}
