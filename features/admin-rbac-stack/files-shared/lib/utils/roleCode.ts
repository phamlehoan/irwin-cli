import { Prisma, Role } from "@db";
import models from "@models";

export type RoleWriteInput = {
  code: string;
  name: string;
  description?: string | null;
};

/** Active role with the same code (excludes soft-deleted rows). */
export async function findActiveRoleByCode(
  code: string,
): Promise<Role | null> {
  return models.role.findFirst({ where: { code, deleted: false } });
}

/** Any row with this code, including soft-deleted (blocks @unique on `code`). */
export async function findAnyRoleByCode(
  code: string,
  exceptId?: string,
): Promise<Role | null> {
  const where: Prisma.RoleWhereInput = { code };
  if (exceptId) where.id = { not: exceptId };
  return models.role.findFirst({ where });
}

/**
 * Create a role or restore a soft-deleted row with the same code.
 * `code` is @unique in Prisma — cannot insert a second row while one is soft-deleted.
 */
export async function createOrRestoreRole(
  input: RoleWriteInput,
): Promise<{ ok: true; role: Role } | { ok: false; reason: "taken" }> {
  const existing = await findAnyRoleByCode(input.code);
  if (existing) {
    if (!existing.deleted) {
      return { ok: false, reason: "taken" };
    }
    const role = await models.role.update({
      where: { id: existing.id },
      data: {
        deleted: false,
        name: input.name,
        description: input.description ?? null,
        isReadOnly: input.code === "ADMIN",
      },
    });
    return { ok: true, role };
  }

  const role = await models.role.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      isReadOnly: input.code === "ADMIN",
    },
  });
  return { ok: true, role };
}

/** True when another row (any id except `exceptId`) already uses `code`. */
export async function isRoleCodeBlocked(
  code: string,
  exceptId?: string,
): Promise<boolean> {
  return (await findAnyRoleByCode(code, exceptId)) !== null;
}
