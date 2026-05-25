import { loadDotenv } from "../loadDotenv";

loadDotenv();

import { PasswordType, UserStatus } from "@models/enums";
import models from "@models";
import bcrypt from "bcrypt";
import { RailsApplication, Security } from "ts-rails";

RailsApplication.hasher = {
  hash: (password) => bcrypt.hash(password, 10),
  verify: (password, hash) => bcrypt.compare(password, hash),
};

async function main() {
  const email = "admin@example.com";
  const password = "password123";
  const hashed = await Security.hashPassword(password);

  const user = await models.user.upsert({
    where: { email },
    create: {
      email,
      firstName: "Admin",
      lastName: "User",
      status: UserStatus.ACTIVE,
      passwords: {
        create: {
          password: hashed,
          type: PasswordType.PASSWORD,
        },
      },
    },
    update: {
      firstName: "Admin",
      lastName: "User",
      status: UserStatus.ACTIVE,
      deleted: false,
    },
  });

  await models.password.deleteMany({
    where: { userId: user.id, type: PasswordType.PASSWORD },
  });
  await models.password.create({
    data: {
      userId: user.id,
      password: hashed,
      type: PasswordType.PASSWORD,
    },
  });

  console.log(`Seeded user ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await models.$disconnect();
  });
