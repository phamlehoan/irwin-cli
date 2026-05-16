import { Cache } from "ts-rails";

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  checks?: Record<string, { status: string; message?: string }>;
}

export async function checkReadiness(): Promise<HealthStatus> {
  const checks: Record<string, { status: string; message?: string }> = {};
  let overall: "ok" | "degraded" | "error" = "ok";

  try {
    Cache.set("_health_check", "1", 5);
    const v = Cache.get("_health_check");
    checks.cache = { status: v === "1" ? "ok" : "degraded" };
  } catch (e) {
    checks.cache = { status: "error", message: (e as Error).message };
    overall = "degraded";
  }

  return {
    status: overall,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  };
}
