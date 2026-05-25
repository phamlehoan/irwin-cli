import models from "@models";
import { BeforeAction } from "ts-rails";
import { ApplicationController } from "../application.controller";

const deletedFilter = { deleted: false };

function hasRbacModels(
  m: typeof models,
): m is typeof models & {
  role: { count: (args: object) => Promise<number> };
  feature: { count: (args: object) => Promise<number> };
} {
  return (
    typeof (m as { role?: { count?: unknown } }).role?.count === "function" &&
    typeof (m as { feature?: { count?: unknown } }).feature?.count ===
      "function"
  );
}

/** Set on session user when admin-rbac middleware is enabled. */
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

@BeforeAction("requireLogin")
export class AdminController extends ApplicationController {
  async index() {
    const userCount = await models.user.count({ where: deletedFilter });
    const activeUserCount = await models.user.count({
      where: { ...deletedFilter, status: "ACTIVE" },
    });

    const hasRbac = hasRbacModels(models);
    let roleCount: number | null = null;
    let featureCount: number | null = null;
    if (hasRbacModels(models)) {
      roleCount = await models.role.count({ where: deletedFilter });
      featureCount = await models.feature.count({ where: deletedFilter });
    }

    const { permissions: perms, usesRbac } = sessionPermissions(
      this.currentUser,
    );
    const can = (code: string) => !usesRbac || perms.includes(code);
    this.render("admin/dashboard.view/index", {
      title: this.t("admin.dashboard"),
      activeMenu: "home",
      userCount,
      activeUserCount,
      roleCount,
      featureCount,
      hasRbac,
      usesRbac,
      canUsers: can("USM::READ"),
      canRoles: hasRbac && can("RAP::READ"),
    });
  }
}
