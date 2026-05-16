import { User } from "@db";

declare global {
  namespace Express {
    interface User extends import("@db").User {}
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: User | null;
  }
}
