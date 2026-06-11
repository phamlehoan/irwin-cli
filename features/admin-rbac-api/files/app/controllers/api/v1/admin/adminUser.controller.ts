import { Prisma } from "@db";
import models from "@models";
import { PasswordType, UserStatus } from "@models/enums";
import {
  CreateUserValidator,
  UpdateUserValidator,
} from "@validators/admin.validator";
import { NotFoundError, Security } from "ts-rails";
import { ApiV1AdminController } from "./admin.controller";

export class ApiV1AdminUserController extends ApiV1AdminController {
  async index() {
    const search = String(this.req.query.search || "").trim();
    const sortBy = String(this.req.query.sortBy || "createdAt");
    const sortOrder = String(this.req.query.sortOrder || "desc") as
      | "asc"
      | "desc";
    const filterStatus = String(this.req.query.filterStatus || "");
    const page = Math.max(1, parseInt(String(this.req.query.page || "1"), 10));
    const perPage = Math.min(
      50,
      Math.max(10, parseInt(String(this.req.query.perPage || "10"), 10)),
    );

    const where: Prisma.UserWhereInput = { deleted: false };
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }
    if (filterStatus) where.status = filterStatus;

    const [users, total] = await Promise.all([
      models.user.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      models.user.count({ where }),
    ]);

    this.renderJson({ users, total, page, perPage });
  }

  async show() {
    const targetUser = await models.user.findFirst({
      where: { id: this.req.params.id, deleted: false },
    });
    if (!targetUser) throw new NotFoundError("User not found");
    this.renderJson({ user: targetUser });
  }

  async create() {
    const data = await this.params(CreateUserValidator).permit(
      "firstName",
      "lastName",
      "email",
      "password",
    );
    const email = data.email.trim().toLowerCase();

    const existing = await models.user.findUnique({ where: { email } });
    if (existing) {
      return this.res.status(422).json({
        success: false,
        error: "An account with this email already exists.",
      });
    }

    const hashed = await Security.hashPassword(data.password);
    const user = await models.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
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

    this.renderJson({ user }, 201);
  }

  async update() {
    const id = this.req.params.id;
    const data = await this.params(UpdateUserValidator).permit(
      "firstName",
      "lastName",
      "email",
      "status",
      "password",
    );

    const targetUser = await models.user.findFirst({
      where: { id, deleted: false },
    });
    if (!targetUser) throw new NotFoundError("User not found");

    const personalData: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined) personalData.firstName = data.firstName;
    if (data.lastName !== undefined) personalData.lastName = data.lastName;
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      const taken = await models.user.findFirst({
        where: { email, id: { not: id } },
      });
      if (taken) {
        return this.res.status(422).json({
          success: false,
          error: "An account with this email already exists.",
        });
      }
      personalData.email = email;
    }
    if (data.status !== undefined) personalData.status = data.status;

    if (Object.keys(personalData).length > 0) {
      await models.user.update({ where: { id }, data: personalData });
    }

    if (data.password) {
      const hashed = await Security.hashPassword(data.password);
      await models.password.create({
        data: {
          userId: id,
          password: hashed,
          type: PasswordType.PASSWORD,
        },
      });
    }

    const user = await models.user.findFirst({ where: { id, deleted: false } });
    this.renderJson({ user });
  }

  async destroy() {
    const id = this.req.params.id;
    const targetUser = await models.user.findFirst({
      where: { id, deleted: false },
    });
    if (!targetUser) throw new NotFoundError("User not found");

    await models.user.update({
      where: { id },
      data: { deleted: true },
    });

    this.renderJson({ ok: true });
  }
}
