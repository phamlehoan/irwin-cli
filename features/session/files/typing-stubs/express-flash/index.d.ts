import "express";

declare module "express-serve-static-core" {
  interface Request {
    flash(type: string, message: unknown): void;
    flash(): Record<string, unknown[]>;
  }
}
