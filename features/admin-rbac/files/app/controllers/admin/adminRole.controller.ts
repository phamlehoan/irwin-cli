import { FlashType } from "@configs/enum";
import { Prisma, User, UserToRole } from "@db";
import models from "@models";
import {
  RoleCreateValidator,
  RoleUpdateValidator,
} from "@validators/role.validator";
import { NotFoundError } from "ts-rails";
import { AdminController } from "./admin.controller";

function sessionPermissions(user: unknown): {
  permissions: string[];
  usesRbac: boolean;
} {
  if (!user || typeof user !== "object") {
    return { permissions: [], usesRbac: false };
  }
  const perms = (user as { permissions?: unknown }).permissions;
  if (!Array.isArray(perms)) {
    return { permissions: [], usesRbac: false };
  }
  return {
    permissions: perms.filter((p): p is string => typeof p === "string"),
    usesRbac: true,
  };
}

const DEFAULT_PER_PAGE = 10;
const PER_PAGE_OPTIONS = [10, 25, 50];

export class AdminRoleController extends AdminController {
  async index() {
    const search = String(this.req.query.search || "").trim();
    const sortBy = String(this.req.query.sortBy || "name");
    const sortOrder = String(this.req.query.sortOrder || "asc") as
      | "asc"
      | "desc";
    const page = Math.max(1, parseInt(String(this.req.query.page || "1"), 10));
    const perPage = Math.min(
      50,
      Math.max(10, parseInt(String(this.req.query.perPage || "10"), 10)),
    );

    const where: Prisma.RoleWhereInput = { deleted: false };
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [roles, total] = await Promise.all([
      models.role.findMany({
        where,
        include: {
          permissions: {
            include: { permission: { include: { feature: true } } },
          },
          _count: { select: { users: true, permissions: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      models.role.count({ where }),
    ]);

    const q: Record<string, string> = {};
    if (search) q.search = search;
    if (sortBy !== "name") q.sortBy = sortBy;
    if (sortOrder !== "asc") q.sortOrder = sortOrder;
    if (perPage !== 10) q.perPage = String(perPage);
    const buildQueryString = () =>
      Object.keys(q).length ? "&" + new URLSearchParams(q).toString() : "";
    const buildSortUrl = (col: string) => {
      const next = sortBy === col && sortOrder === "asc" ? "desc" : "asc";
      return `/admin/roles?${new URLSearchParams({ ...q, sortBy: col, sortOrder: next, page: "1" }).toString()}`;
    };

    this.render("admin/role.view/index", {
      title: this.t("admin.roles"),
      activeMenu: "roles",
      roles,
      total,
      page,
      perPage,
      search,
      sortBy,
      sortOrder,
      buildQueryString,
      buildSortUrl,
    });
  }

  async show() {
    const roleId = this.req.params.id;
    const role = await models.role.findFirst({
      where: { id: roleId, deleted: false },
      include: {
        permissions: {
          include: {
            permission: { include: { feature: true } },
          },
        },
      },
    });
    if (!role) throw new NotFoundError("Role not found");

    const features = await models.feature.findMany({
      where: { deleted: false },
      include: {
        permissions: { where: { deleted: false } },
      },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    });

    const search = String(this.req.query.search || "").trim();
    const page = Math.max(1, parseInt(String(this.req.query.page || "1"), 10));
    const sortBy = String(this.req.query.sortBy || "accountName");
    const sortOrder = String(this.req.query.sortOrder || "asc") as
      | "asc"
      | "desc";
    const filterStatus = String(this.req.query.filterStatus || "");
    const perPageRaw = parseInt(
      String(this.req.query.perPage || DEFAULT_PER_PAGE),
      10,
    );
    const perPage = PER_PAGE_OPTIONS.includes(perPageRaw)
      ? perPageRaw
      : DEFAULT_PER_PAGE;

    const usersInRole = await models.userToRole.findMany({
      where: { roleId },
      include: { user: true },
    });

    let assignedUsers = usersInRole.map(
      (ur: UserToRole & { user: User }) => ur.user,
    );

    if (search) {
      const q = search.toLowerCase();
      assignedUsers = assignedUsers.filter(
        (u: User) =>
          `${u.firstName || ""} ${u.lastName || ""}`
            .trim()
            .toLowerCase()
            .includes(q) || u.email.toLowerCase().includes(q),
      );
    }

    if (filterStatus) {
      assignedUsers = assignedUsers.filter(
        (u: User) => u.status === filterStatus,
      );
    }

    const cmp = (a: string, b: string) =>
      sortOrder === "asc" ? (a < b ? -1 : 1) : a > b ? -1 : 1;
    assignedUsers.sort((a: User, b: User) => {
      const an = `${a.firstName || ""} ${a.lastName || ""}`.trim();
      const bn = `${b.firstName || ""} ${b.lastName || ""}`.trim();
      if (sortBy === "accountName") return cmp(an, bn);
      if (sortBy === "email") return cmp(a.email, b.email);
      return cmp(an, bn);
    });

    const totalAssigned = assignedUsers.length;
    const totalPages =
      totalAssigned === 0
        ? 1
        : Math.max(1, Math.ceil(totalAssigned / perPage));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const skip = (safePage - 1) * perPage;
    const paginatedUsers = assignedUsers.slice(skip, skip + perPage);

    const q: Record<string, string> = {};
    if (search) q.search = search;
    if (sortBy && sortBy !== "accountName") q.sortBy = sortBy;
    if (sortOrder && sortOrder !== "asc") q.sortOrder = sortOrder;
    if (filterStatus) q.filterStatus = filterStatus;
    if (perPage !== DEFAULT_PER_PAGE) q.perPage = String(perPage);
    const buildQueryString = () =>
      Object.keys(q).length ? "&" + new URLSearchParams(q).toString() : "";
    const buildSortUrl = (col: string) => {
      const nextOrder = sortBy === col && sortOrder === "asc" ? "desc" : "asc";
      const params = new URLSearchParams({
        ...q,
        sortBy: col,
        sortOrder: nextOrder,
        page: "1",
      });
      return `/admin/roles/${roleId}?${params.toString()}`;
    };

    const { permissions: userPerms, usesRbac } = sessionPermissions(
      this.currentUser,
    );
    const canUpdateRole =
      !usesRbac || userPerms.includes("RAP::UPDATE");

    this.render("admin/role.view/show", {
      title: role.name,
      activeMenu: "roles",
      role,
      features,
      canUpdateRole,
      assignedUsers: paginatedUsers,
      totalAssigned,
      page: safePage,
      perPage,
      totalPages,
      search,
      sortBy,
      sortOrder,
      filterStatus,
      buildSortUrl,
      buildQueryString,
    });
  }

  async assignPage() {
    const { role, usersToAssign, search } = await this.getAssignData();
    if (this.req.headers["accept"]?.includes("application/json")) {
      return this.res.json({ role, usersToAssign, search });
    }
    this.render("admin/role.view/assign", {
      title: this.t("admin.assign_user"),
      activeMenu: "roles",
      role,
      usersToAssign,
      search,
    });
  }

  async assignUsersJson() {
    const { usersToAssign, role } = await this.getAssignData();
    this.res.json({ usersToAssign, role: { id: role.id, name: role.name } });
  }

  private async getAssignData() {
    const roleId = this.req.params.id;
    const role = await models.role.findFirst({
      where: { id: roleId, deleted: false },
    });
    if (!role) throw new NotFoundError("Role not found");

    const usersInRole = await models.userToRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    const userIdsInRole = usersInRole.map(
      (ur: { userId: string }) => ur.userId,
    );

    const search = String(this.req.query.search || "").trim();
    const where: Prisma.UserWhereInput = {
      deleted: false,
      id: { notIn: userIdsInRole },
    };
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const usersToAssign = await models.user.findMany({
      where,
      orderBy: { email: "asc" },
      take: 50,
    });

    return { role, usersToAssign, search };
  }

  async assignUser() {
    const roleId = this.req.params.id;
    const userIds = Array.isArray(this.req.body.userIds)
      ? this.req.body.userIds
      : this.req.body.userIds
        ? [this.req.body.userIds]
        : [];
    if (userIds.length === 0) {
      this.flash(FlashType.Errors, { msg: this.t("admin.select_one_user") });
      return this.redirect(`/admin/roles/${roleId}`);
    }

    const role = await models.role.findFirst({
      where: { id: roleId, deleted: false },
    });
    if (!role) throw new NotFoundError("Role not found");

    for (const userId of userIds) {
      await models.userToRole.upsert({
        where: {
          userId_roleId: { userId, roleId },
        },
        create: { userId, roleId },
        update: {},
      });
    }

    this.flash(FlashType.Success, {
      msg: this.t("admin.users_assigned", { count: userIds.length }),
    });
    this.redirect(`/admin/roles/${roleId}`);
  }

  async unassignUser() {
    const { id: roleId, userId } = this.req.params;
    await models.userToRole.deleteMany({
      where: { userId, roleId },
    });
    this.flash(FlashType.Success, { msg: this.t("admin.user_unassigned") });
    this.redirect(`/admin/roles/${roleId}`);
  }

  async edit() {
    const role = await models.role.findFirst({
      where: { id: this.req.params.id, deleted: false },
    });
    if (!role) throw new NotFoundError("Role not found");
    if (role.isReadOnly) {
      this.flash(FlashType.Errors, { msg: this.t("admin.role_read_only") });
      return this.redirect(`/admin/roles/${role.id}`);
    }

    this.render("admin/role.view/edit", {
      title: this.t("admin.edit_role"),
      activeMenu: "roles",
      role,
    });
  }

  async update() {
    const id = this.req.params.id;
    const hasPermissionIds = "permissionIds" in (this.req.body || {});
    const data = await this.params(RoleUpdateValidator).permit(
      "code",
      "name",
      "description",
      ...(hasPermissionIds ? (["permissionIds"] as const) : []),
    );
    const { code, name, description, permissionIds } = data;

    const role = await models.role.findFirst({ where: { id, deleted: false } });
    if (!role) throw new NotFoundError("Role not found");

    const updateData: Prisma.RoleUpdateInput = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (Object.keys(updateData).length) {
      if (role.isReadOnly) {
        this.flash(FlashType.Errors, { msg: this.t("admin.role_read_only") });
        return this.redirect(`/admin/roles/${id}`);
      }
      await models.role.update({ where: { id }, data: updateData });
    }

    if (hasPermissionIds) {
      if (role.isReadOnly) {
        this.flash(FlashType.Errors, { msg: this.t("admin.role_read_only") });
        return this.redirect(`/admin/roles/${id}`);
      }
      const permissionIdsArr = Array.isArray(permissionIds)
        ? permissionIds
        : permissionIds
          ? [permissionIds]
          : [];
      await models.roleToPermission.deleteMany({ where: { roleId: id } });
      for (const permissionId of permissionIdsArr) {
        await models.roleToPermission.create({
          data: { roleId: id, permissionId },
        });
      }
      this.flash(FlashType.Success, {
        msg: this.t("admin.permissions_updated"),
      });
    } else {
      this.flash(FlashType.Success, { msg: this.t("admin.role_updated") });
    }

    this.redirect(`/admin/roles/${id}`);
  }

  async new() {
    this.render("admin/role.view/new", {
      title: this.t("admin.new_role"),
      activeMenu: "roles",
    });
  }

  async create() {
    const data = await this.params(RoleCreateValidator).permit(
      "code",
      "name",
      "description",
    );
    const { code, name, description } = data;

    const existing = await models.role.findFirst({
      where: { code, deleted: false },
    });
    if (existing) {
      this.flash(FlashType.Errors, { msg: this.t("admin.role_code_taken") });
      return this.redirect("/admin/roles/new");
    }

    const role = await models.role.create({
      data: {
        code: code || "",
        name: name || "",
        description: description || "",
      },
    });

    this.flash(FlashType.Success, { msg: this.t("admin.role_created") });
    this.redirect(`/admin/roles/${role.id}`);
  }

  async destroy() {
    const id = this.req.params.id;
    const role = await models.role.findFirst({ where: { id, deleted: false } });
    if (!role) throw new NotFoundError("Role not found");
    if (role.isReadOnly) {
      this.flash(FlashType.Errors, { msg: this.t("admin.role_read_only") });
      return this.redirect(`/admin/roles/${id}`);
    }

    await models.role.update({
      where: { id },
      data: { deleted: true },
    });

    this.flash(FlashType.Success, { msg: this.t("admin.role_deleted") });
    this.redirect("/admin/roles");
  }
}
