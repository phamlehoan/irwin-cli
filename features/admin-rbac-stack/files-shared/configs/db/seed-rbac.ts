import { loadDotenv } from "../loadDotenv";

loadDotenv();

import models from "@models";
import { seedFeatures } from "./seeders/features";

async function main() {
  await seedFeatures();

  const role = await models.role.findFirst({
    where: { code: "ADMIN", deleted: false },
  });
  if (!role) {
    console.warn("[seed-rbac] ADMIN role missing");
    return;
  }

  const admin = await models.user.findFirst({
    where: { email: "admin@example.com", deleted: false },
  });
  if (!admin) {
    console.log("[seed-rbac] No admin@example.com — run db:seed first");
    return;
  }

  await models.userToRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: role.id } },
    create: { userId: admin.id, roleId: role.id },
    update: {},
  });

  console.log(`[seed-rbac] ADMIN role assigned to ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await models.$disconnect();
  });
