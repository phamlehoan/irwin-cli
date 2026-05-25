import env from "@configs/env";
import * as jobs from "@jobs";
import { getJobAdapter } from "@lib/utils/jobs";
import cron from "node-cron";
import { RailsApplication } from "ts-rails";

let cronStarted = false;

async function startCronJobs(): Promise<void> {
  if (cronStarted) return;
  if (env.appEnv !== "development" && env.appEnv !== "production") return;

  for (const Klass of Object.values(jobs) as Array<{
    cron?: string;
    new (): { perform: (...a: unknown[]) => Promise<void> };
  }>) {
    if (typeof Klass !== "function" || !Klass.cron) continue;
    cron.schedule(Klass.cron, () => {
      void new Klass().perform();
    });
  }

  cronStarted = true;
  RailsApplication.loggerAdapter?.info("[jobs] Cron schedules registered");
}

export function initializeJobs(): void {
  RailsApplication.jobClasses = Object.values(jobs) as never[];
  (RailsApplication as { jobAdapter?: unknown }).jobAdapter = getJobAdapter();

  if (
    !process.env.LAMBDA_TASK_ROOT &&
    !process.env.VERCEL &&
    !process.env.IS_OFFLINE &&
    !process.env.IRWIN_CONSOLE
  ) {
    void startCronJobs();
  }
}
