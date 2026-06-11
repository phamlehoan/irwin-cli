import { Prisma, User, UserToRole } from "@db";
import { createOrRestoreRole, isRoleCodeBlocked } from "@lib/utils/roleCode";
import models from "@models";
import {
  RoleCreateValidator,
  RoleUpdateValidator,
} from "@validators/role.validator";
import { NotFoundError } from "ts-rails";
import { ApiV1AdminController } from "./admin.controller";

export class ApiV1AdminRoleController extends ApiV1AdminController {
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

    this.renderJson({ roles, total, page, perPage, search, sortBy, sortOrder });
  }

  async show() {
    const roleId = this.req.params.id;
    const role = await models.role.findFirst({
      where: { id: roleId, deleted: false },
      include: {
        permissions: {
          include: { permission: { include: { feature: true } } },
        },
      },
    });
    if (!role) throw new NotFoundError("Role not found");

    const features = await models.feature.findMany({
      where: { deleted: false },
      include: { permissions: { where: { deleted: false } } },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    });

    const usersInRole = await models.userToRole.findMany({
      where: { roleId },
      include: { user: true },
    });
    const assignedUsers = usersInRole
      .map((ur: UserToRole & { user: User }) => ur.user)
      .filter((u) => !u.deleted);

    this.renderJson({ role, features, assignedUsers });
  }

  async assignCandidates() {
    const { role, usersToAssign, search } = await this.getAssignData();
    this.renderJson({ role, usersToAssign, search });
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

  async assignUsers() {
    const roleId = this.req.params.id;
    const userIds = Array.isArray(this.req.body.userIds)
      ? this.req.body.userIds
      : this.req.body.userIds
        ? [this.req.body.userIds]
        : [];
    if (userIds.length === 0) {
      return this.res.status(422).json({
        success: false,
        error: "Select at least one user.",
      });
    }

    const role = await models.role.findFirst({
      where: { id: roleId, deleted: false },
    });
    if (!role) throw new NotFoundError("Role not found");
    if (role.isReadOnly) {
      return this.res.status(403).json({
        success: false,
        error: "This role cannot be changed.",
      });
    }

    for (const userId of userIds) {
      await models.userToRole.upsert({
        where: { userId_roleId: { userId, roleId } },
        create: { userId, roleId },
        update: {},
      });
    }

    this.renderJson({ ok: true, assigned: userIds.length });
  }

  async unassignUser() {
    const { id: roleId, userId } = this.req.params;
    const role = await models.role.findFirst({
      where: { id: roleId, deleted: false },
    });
    if (!role) throw new NotFoundError("Role not found");
    if (role.isReadOnly) {
      return this.res.status(403).json({
        success: false,
        error: "This role cannot be changed.",
      });
    }

    await models.userToRole.deleteMany({ where: { userId, roleId } });
    this.renderJson({ ok: true });
  }

  async create() {
    const data = await this.params(RoleCreateValidator).permit(
      "code",
      "name",
      "description",
    );

    const result = await createOrRestoreRole({
      code: data.code || "",
      name: data.name || "",
      description: data.description || "",
    });
    if (!result.ok) {
      return this.res.status(422).json({
        success: false,
        error: "Role code already exists.",
      });
    }

    this.renderJson({ role: result.role }, 201);
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

    const role = await models.role.findFirst({ where: { id, deleted: false } });
    if (!role) throw new NotFoundError("Role not found");
    if (role.isReadOnly) {
      return this.res.status(403).json({
        success: false,
        error: "This role cannot be changed.",
      });
    }

    const updateData: Prisma.RoleUpdateInput = {};
    if (data.code !== undefined) updateData.code = data.code;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (Object.keys(updateData).length) {
      if (
        data.code !== undefined &&
        data.code !== role.code &&
        (await isRoleCodeBlocked(data.code, id))
      ) {
        return this.res.status(422).json({
          success: false,
          error: "Role code already exists.",
        });
      }
      await models.role.update({ where: { id }, data: updateData });
    }

    if (hasPermissionIds) {
      const permissionIdsArr = Array.isArray(data.permissionIds)
        ? data.permissionIds
        : data.permissionIds
          ? [data.permissionIds]
          : [];
      await models.roleToPermission.deleteMany({ where: { roleId: id } });
      for (const permissionId of permissionIdsArr) {
        await models.roleToPermission.create({
          data: { roleId: id, permissionId },
        });
      }
    }

    const updated = await models.role.findFirst({
      where: { id, deleted: false },
      include: {
        permissions: {
          include: { permission: { include: { feature: true } } },
        },
      },
    });
    this.renderJson({ role: updated });
  }

  async destroy() {
    const id = this.req.params.id;
    const role = await models.role.findFirst({ where: { id, deleted: false } });
    if (!role) throw new NotFoundError("Role not found");
    if (role.isReadOnly) {
      return this.res.status(403).json({
        success: false,
        error: "This role cannot be changed.",
      });
    }

    await models.role.update({
      where: { id },
      data: { deleted: true },
    });

    this.renderJson({ ok: true });
  }
}
