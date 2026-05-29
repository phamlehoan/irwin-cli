import env from "@configs/env";
import { generateToken } from "@lib/utils/jwt";

export const INVITE_TOKEN_PURPOSE = "invite_activate";

function activationBaseUrl(): string {
  const fromEnv =
    (process.env.CLIENT_APP_URL || process.env.APP_URL || "").trim() ||
    `http://localhost:${process.env.PORT || "8000"}`;
  return fromEnv.replace(/\/$/, "");
}

export function buildActivateAccountUrl(token: string): string {
  const base = activationBaseUrl();
  const enc = encodeURIComponent(token);
  const hashRouter = process.env.CLIENT_APP_HASH_ROUTER !== "false";
  if (hashRouter) {
    return `${base}/#/activate-account?token=${enc}`;
  }
  return `${base}/activate-account?token=${enc}`;
}

export function generateInviteToken(userId: string): string {
  return generateToken(
    { id: userId, purpose: INVITE_TOKEN_PURPOSE },
    "7d",
  );
}
