import models from "@models";
import {
  AuthChangePasswordService,
  AuthInviteService,
  AuthLoginService,
  AuthRegisterService,
  AuthPasswordResetService,
  AuthRefreshTokenService,
  AuthUpdateProfileService,
} from "@services";
import {
  ChangeMyPasswordValidator,
  InviteAcceptValidator,
  LoginValidator,
  RegisterApiValidator,
  RefreshTokenValidator,
  UpdateMyProfileValidator,
} from "@validators/auth.validator";
import {
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "ts-rails";
import { ApiV1Controller } from "./apiV1.controller";

export class AuthController extends ApiV1Controller {
  async register() {
    const data = await this.params(RegisterApiValidator).permit(
      "firstName",
      "lastName",
      "middleName",
      "email",
      "password",
      "passwordConfirmation",
    );
    try {
      const result = await new AuthRegisterService().execute(data);
      if (result.activationRequired) {
        return this.renderJson(
          {
            status: result.status,
            activationRequired: true,
            emailSent: result.emailSent,
            user: result.user,
            message: result.emailSent
              ? "Check your email to activate your account."
              : "Account created but activation email could not be sent.",
          },
          201,
        );
      }

      const login = await new AuthLoginService().execute(
        data.email,
        data.password,
      );
      return this.renderJson(
        {
          status: result.status,
          activationRequired: false,
          ...login,
        },
        201,
      );
    } catch (e) {
      if (e instanceof UnprocessableEntityError) {
        if (e.message === "REGISTRATION_EMAIL_EXISTS") {
          return this.res.status(422).json({
            success: false,
            error: "An account with this email already exists.",
          });
        }
        if (e.message === "PASSWORD_MISMATCH") {
          return this.res.status(422).json({
            success: false,
            error: "Passwords do not match.",
          });
        }
      }
      throw e;
    }
  }

  async login() {
    const { email, password } = await this.params(LoginValidator).permit(
      "email",
      "password",
    );
    try {
      const result = await new AuthLoginService().execute(email, password);
      this.renderJson(result);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return this.res.status(401).json({
          success: false,
          error: e.message || "Unauthorized",
        });
      }
      throw e;
    }
  }

  async me() {
    const userId = this.req.user?.id;
    if (!userId) {
      return this.res
        .status(401)
        .json({ success: false, error: "Unauthorized" });
    }
    const user = await models.user.findUnique({ where: { id: userId } });
    if (!user || user.deleted) {
      return this.res
        .status(401)
        .json({ success: false, error: "Unauthorized" });
    }
    this.renderJson({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        fullName: `${user.firstName} ${user.lastName}`,
        avatarUrl: user.avatarUrl,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        address: user.address,
        status: user.status,
      },
    });
  }

  async updateProfile() {
    const userId = this.req.user?.id;
    if (!userId) {
      return this.res
        .status(401)
        .json({ success: false, error: "Unauthorized" });
    }
    const data = await this.params(UpdateMyProfileValidator).permit(
      "firstName",
      "lastName",
      "middleName",
      "gender",
      "phoneNumber",
      "address",
    );
    try {
      const result = await new AuthUpdateProfileService().execute(userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        gender: data.gender,
        phoneNumber: data.phoneNumber,
        address: data.address,
      });
      this.renderJson(result);
    } catch (e) {
      if (e instanceof NotFoundError) {
        return this.res
          .status(404)
          .json({ success: false, error: e.message || "Not found" });
      }
      if (e instanceof UnprocessableEntityError) {
        return this.res
          .status(422)
          .json({ success: false, error: e.message });
      }
      throw e;
    }
  }

  async changePassword() {
    const userId = this.req.user?.id;
    if (!userId) {
      return this.res
        .status(401)
        .json({ success: false, error: "Unauthorized" });
    }
    const { oldPassword, newPassword, newPasswordConfirmation } =
      await this.params(ChangeMyPasswordValidator).permit(
        "oldPassword",
        "newPassword",
        "newPasswordConfirmation",
      );
    try {
      await new AuthChangePasswordService().execute(
        userId,
        oldPassword,
        newPassword,
        newPasswordConfirmation,
      );
      this.renderJson({ ok: true });
    } catch (e) {
      if (e instanceof UnprocessableEntityError) {
        return this.res
          .status(422)
          .json({ success: false, error: e.message });
      }
      throw e;
    }
  }

  async inviteVerify() {
    const token = String(this.req.query.token || "").trim();
    if (!token) {
      return this.res
        .status(400)
        .json({ success: false, error: "Token is required" });
    }
    try {
      const preview = await new AuthInviteService().getInvitePreview(token);
      this.renderJson(preview);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return this.res.status(401).json({
          success: false,
          error: e.message || "Unauthorized",
        });
      }
      throw e;
    }
  }

  async inviteAccept() {
    const { token, password, passwordConfirmation } =
      await this.params(InviteAcceptValidator).permit(
        "token",
        "password",
        "passwordConfirmation",
      );
    try {
      const result = await new AuthInviteService().acceptInvite(
        token,
        password,
        passwordConfirmation,
      );
      this.renderJson(result);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return this.res.status(401).json({
          success: false,
          error: e.message || "Unauthorized",
        });
      }
      if (e instanceof UnprocessableEntityError) {
        return this.res
          .status(422)
          .json({ success: false, error: e.message });
      }
      throw e;
    }
  }

  async passwordResetVerify() {
    const token = String(this.req.query.token || "").trim();
    if (!token) {
      return this.res
        .status(400)
        .json({ success: false, error: "Token is required" });
    }
    try {
      const preview = await new AuthPasswordResetService().getResetPreview(
        token,
      );
      this.renderJson(preview);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return this.res.status(401).json({
          success: false,
          error: e.message || "Unauthorized",
        });
      }
      throw e;
    }
  }

  async passwordResetAccept() {
    const { token, password, passwordConfirmation } =
      await this.params(InviteAcceptValidator).permit(
        "token",
        "password",
        "passwordConfirmation",
      );
    try {
      const result = await new AuthPasswordResetService().acceptReset(
        token,
        password,
        passwordConfirmation,
      );
      this.renderJson(result);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return this.res.status(401).json({
          success: false,
          error: e.message || "Unauthorized",
        });
      }
      if (e instanceof UnprocessableEntityError) {
        return this.res
          .status(422)
          .json({ success: false, error: e.message });
      }
      throw e;
    }
  }

  async refreshToken() {
    const { refreshToken } = await this.params(RefreshTokenValidator).permit(
      "refreshToken",
    );
    try {
      const result = await new AuthRefreshTokenService().execute(refreshToken);
      this.renderJson(result);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        return this.res.status(401).json({
          success: false,
          error: e.message || "Unauthorized",
        });
      }
      throw e;
    }
  }
}
