import models from "@models";
import {
  assignAllPermissionsToRole,
  ensureRole,
  registerFeature,
  setFeatureParents,
} from "./registerFeature";

const ROUTE_FEATURE_CODES = ["AM", "USM", "RAP"] as const;

const ROUTE_PERMISSIONS_BY_FEATURE: Record<string, readonly string[]> = {
  USM: ["READ", "CREATE", "UPDATE", "DELETE"],
  RAP: ["READ", "CREATE", "UPDATE", "DELETE"],
};

export const FEATURES = [
  {
    code: "AM",
    name: "Administration",
    description: "Admin menu group",
    type: "MENU_GROUP",
    parentCode: null as string | null,
    sortOrder: 0,
    permissionCodes: [] as const,
  },
  {
    code: "USM",
    name: "User management",
    description: "Users CRUD",
    type: "FEATURE",
    parentCode: "AM",
    sortOrder: 1,
    permissionCodes: ROUTE_PERMISSIONS_BY_FEATURE.USM,
  },
  {
    code: "RAP",
    name: "Roles & permissions",
    description: "Roles, features, permissions",
    type: "FEATURE",
    parentCode: "AM",
    sortOrder: 2,
    permissionCodes: ROUTE_PERMISSIONS_BY_FEATURE.RAP,
  },
];

async function pruneRolesExceptAdmin() {
  const r = await models.role.updateMany({
    where: { code: { not: "ADMIN" }, deleted: false },
    data: { deleted: true },
  });
  if (r.count > 0) {
    console.log(`[seedFeatures] Soft-deleted ${r.count} extra role(s)`);
  }
}

export async function seedFeatures() {
  for (const def of FEATURES) {
    await registerFeature(def);
  }
  await setFeatureParents(FEATURES);

  await ensureRole("ADMIN", "Administrator", "Full access");
  await pruneRolesExceptAdmin();
  await assignAllPermissionsToRole("ADMIN");

  console.log("[seedFeatures] Done");
}
