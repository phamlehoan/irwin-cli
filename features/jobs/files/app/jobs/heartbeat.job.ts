import { logger } from "ts-rails";
import { ApplicationJob } from "./application.job";

/** Example scheduled job — runs every 5 minutes in development/production. */
export class HeartbeatJob extends ApplicationJob {
  static cron = "*/5 * * * *";

  async perform(): Promise<void> {
    logger.info("[HeartbeatJob] tick");
  }
}
