import env from "@configs/env";
import { RailsApplication } from "ts-rails";

export function isMailDeliveryConfigured(): boolean {
  if (!RailsApplication.mailerAdapter) return false;
  const from = (env.emailFrom || "").trim();
  if (!from) return false;
  const service = (env.mailService || "").trim().toLowerCase();
  if (service === "test") return true;
  if (service === "smtp") {
    return Boolean(
      (env.mailHost || "").trim() &&
        (env.mailUser || "").trim() &&
        (env.mailPass || "").trim(),
    );
  }
  return false;
}
