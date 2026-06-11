import { User } from "@db";
import { getMergedPermissionStrings } from "@lib/utils/userPermissions";
import models from "@models";

export type UserWithPermissions = User & {
  features?: string[];
  permissions?: string[];
};

export class ApplicationMiddleware {
  public async getUserById(
    id: string,
    withPermissions = false,
  ): Promise<UserWithPermissions | null> {
    const user = await models.user.findUnique({ where: { id } });
    if (!user || !withPermissions) return user;

    let permissionStrings: string[] = [];
    try {
      permissionStrings = await getMergedPermissionStrings(user.id);
    } catch {
      return user;
    }
    const features = new Set<string>();
    for (const s of permissionStrings) {
      const [fc] = s.split("::", 2);
      if (fc) features.add(fc);
    }
    return {
      ...user,
      features: Array.from(features),
      permissions: permissionStrings,
    };
  }
}
