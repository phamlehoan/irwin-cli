import models from "@models";

export function canonPermissionString(code: string): string {
  if (!code || typeof code !== "string") return code;
  const i = code.indexOf("::");
  if (i === -1) return code;
  const feat = code.slice(0, i);
  const perm = code.slice(i + 2);
  return `${feat}::${perm.toUpperCase()}`;
}

export async function getMergedPermissionStrings(
  userId: string,
): Promise<string[]> {
  const fromRoles = await models.feature.findMany({
    where: {
      deleted: false,
      permissions: {
        some: {
          deleted: false,
          roles: {
            some: {
              role: {
                deleted: false,
                users: { some: { userId } },
              },
            },
          },
        },
      },
    },
    select: {
      code: true,
      permissions: {
        where: { deleted: false },
        select: { code: true },
      },
    },
  });

  const direct = await models.userToPermission.findMany({
    where: { userId },
    include: { permission: { include: { feature: true } } },
  });

  const out = new Set<string>();
  for (const f of fromRoles) {
    for (const p of f.permissions) {
      out.add(canonPermissionString(`${f.code}::${p.code}`));
    }
  }
  for (const row of direct) {
    const feat = row.permission.feature;
    if (!feat.deleted && !row.permission.deleted) {
      out.add(canonPermissionString(`${feat.code}::${row.permission.code}`));
    }
  }
  return Array.from(out);
}
