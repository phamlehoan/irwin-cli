import env from "@configs/env";
import jwt, { SignOptions } from "jsonwebtoken";

export interface JwtPayload extends jwt.JwtPayload {
  id?: string;
  purpose?: string;
}

const JWT_SECRET =
  (process.env.JWT_SECRET || (env as { jwtSecret?: string }).jwtSecret) ||
  process.env.SESSION_SECRET ||
  "change-me-jwt-secret";

export function generateToken(payload: object, expiresIn: string = "3h"): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiresIn as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === "string") throw new Error("Invalid token payload");
  return decoded as JwtPayload;
}
