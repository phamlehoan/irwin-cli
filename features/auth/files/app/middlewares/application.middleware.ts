import { User } from "@db";
import models from "@models";

export class ApplicationMiddleware {
  public async getUserById(id: string): Promise<User | null> {
    return models.user.findUnique({ where: { id } });
  }
}
