import models from "@models";

const PERMISSION_CODES = ["READ", "CREATE", "UPDATE", "DELETE"] as const;

export interface FeatureDefinition {
  code: string;
  name: string;
  description?: string;
  type?: string;
  parentCode?: string | null;
  sortOrder?: number;
  permissionCodes?: readonly string[];
}

export async function registerFeature(def: FeatureDefinition) {
  let feature = await models.feature.findFirst({
    where: { code: def.code, deleted: false },
  });

  if (!feature) {
    feature = await models.feature.create({
      data: {
        code: def.code,
        name: def.name,
        description: def.description || null,
        type: def.type || "FEATURE",
        sortOrder: def.sortOrder ?? 0,
      },
    });
    console.log(`[registerFeature] Created feature: ${def.code}`);
  }

  const codes: readonly string[] =
    def.permissionCodes ??
    (feature.type === "MENU_GROUP" ? [] : [...PERMISSION_CODES]);

  for (const code of codes) {
    const existing = await models.permission.findFirst({
      where: { code, featureId: feature.id, deleted: false },
    });
    if (!existing) {
      await models.permission.create({
        data: {
          code,
          name: code,
          description: `${def.code}::${code}`,
          featureId: feature.id,
        },
      });
    }
  }

  return feature;
}

export async function setFeatureParents(
  features: Array<{ code: string; parentCode?: string | null }>,
) {
  for (const def of features) {
    if (!def.parentCode) continue;
    const parent = await models.feature.findFirst({
      where: { code: def.parentCode, deleted: false },
    });
    if (!parent) continue;
    const feature = await models.feature.findFirst({
      where: { code: def.code, deleted: false },
    });
    if (feature && feature.parentId !== parent.id) {
      await models.feature.update({
        where: { id: feature.id },
        data: { parentId: parent.id },
      });
    }
  }
}

export async function ensureRole(
  roleCode: string,
  name: string,
  description?: string | null,
) {
  const existing = await models.role.findFirst({ where: { code: roleCode } });
  if (existing) {
    if (existing.deleted) {
      const restored = await models.role.update({
        where: { id: existing.id },
        data: {
          deleted: false,
          name,
          description: description ?? null,
          isReadOnly: roleCode === "ADMIN",
        },
      });
      console.log(`[ensureRole] Restored role: ${roleCode}`);
      return restored;
    }
    return existing;
  }

  const role = await models.role.create({
    data: {
      code: roleCode,
      name,
      description: description ?? null,
      isReadOnly: roleCode === "ADMIN",
    },
  });
  console.log(`[ensureRole] Created role: ${roleCode}`);
  return role;
}

export async function assignAllPermissionsToRole(roleCode: string) {
  const role = await models.role.findFirst({
    where: { code: roleCode, deleted: false },
  });
  if (!role) throw new Error(`Role ${roleCode} not found`);

  const all = await models.permission.findMany({ where: { deleted: false } });
  for (const p of all) {
    await models.roleToPermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: p.id },
      },
      create: { roleId: role.id, permissionId: p.id },
      update: {},
    });
  }
  console.log(
    `[assignAllPermissionsToRole] ${roleCode} <- ${all.length} permission(s)`,
  );
}
