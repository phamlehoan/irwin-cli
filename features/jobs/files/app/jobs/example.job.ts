import { ApplicationJob } from "./application.job";

/**
 * Ví dụ job theo lịch — tắt/bật tại Admin → Background Jobs → Scheduled jobs.
 */
export class ExampleJob extends ApplicationJob {
  static cron = "*/5 * * * *";

  async perform(): Promise<void> {
    console.log("[ExampleJob] Running at", new Date().toISOString());
  }
}
