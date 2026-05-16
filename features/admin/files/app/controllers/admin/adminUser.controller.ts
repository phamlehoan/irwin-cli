import { FlashType } from "@configs/enum";
import { Prisma } from "@db";
import models from "@models";
import { PasswordType, UserStatus } from "@models/enums";
import {
  CreateUserValidator,
  UpdateUserValidator,
} from "@validators/admin.validator";
import { NotFoundError, Security } from "ts-rails";
import { AdminController } from "./admin.controller";

export class AdminUserController extends AdminController {
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

    const q: Record<string, string> = {};
    if (search) q.search = search;
    if (sortBy !== "createdAt") q.sortBy = sortBy;
    if (sortOrder !== "desc") q.sortOrder = sortOrder;
    if (filterStatus) q.filterStatus = filterStatus;
    if (perPage !== 10) q.perPage = String(perPage);

    const buildSortUrl = (col: string) => {
      const next = sortBy === col && sortOrder === "asc" ? "desc" : "asc";
      return `/admin/users?${new URLSearchParams({ ...q, sortBy: col, sortOrder: next, page: "1" }).toString()}`;
    };

    this.render("admin/user.view/index", {
      title: this.t("admin.users"),
      activeMenu: "users",
      users,
      total,
      page,
      perPage,
      search,
      sortBy,
      sortOrder,
      filterStatus,
      buildSortUrl,
    });
  }

  async show() {
    const targetUser = await models.user.findFirst({
      where: { id: this.req.params.id, deleted: false },
    });
    if (!targetUser) throw new NotFoundError("User not found");

    this.render("admin/user.view/show", {
      title: targetUser.email,
      activeMenu: "users",
      targetUser,
    });
  }

  async new() {
    this.render("admin/user.view/new", {
      title: this.t("admin.new_user"),
      activeMenu: "users",
    });
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
      this.flash(FlashType.Errors, { msg: this.t("admin.email_taken") });
      return this.redirect("/admin/users/new");
    }

    const hashed = await Security.hashPassword(data.password);

    await models.user.create({
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

    this.flash(FlashType.Success, { msg: this.t("admin.user_created") });
    this.redirect("/admin/users");
  }

  async edit() {
    const targetUser = await models.user.findFirst({
      where: { id: this.req.params.id, deleted: false },
    });
    if (!targetUser) throw new NotFoundError("User not found");

    this.render("admin/user.view/edit", {
      title: this.t("admin.edit_user"),
      activeMenu: "users",
      targetUser,
    });
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

    const personalData: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined) personalData.firstName = data.firstName;
    if (data.lastName !== undefined) personalData.lastName = data.lastName;
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      const taken = await models.user.findFirst({
        where: { email, id: { not: id } },
      });
      if (taken) {
        this.flash(FlashType.Errors, { msg: this.t("admin.email_taken") });
        return this.redirect(`/admin/users/${id}/edit`);
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

    this.flash(FlashType.Success, { msg: this.t("admin.user_updated") });
    this.redirect(`/admin/users/${id}`);
  }

  async destroy() {
    const id = this.req.params.id;
    await models.user.update({
      where: { id },
      data: { deleted: true },
    });
    this.flash(FlashType.Success, { msg: this.t("admin.user_deleted") });
    this.redirect("/admin/users");
  }
}
