/**
 * Base class cho jobs - tương tự ActiveJob trong Rails.
 * `static cron` → node-cron (không ghi DB; pause/run trong Admin → Jobs).
 * `performLater()` → hàng đợi tạm (xóa khỏi DB khi xong).
 */
import { RailsApplication } from "ts-rails";

export abstract class ApplicationJob {
  static cron?: string;

  abstract perform(...args: unknown[]): Promise<void>;

  async performLater(...args: unknown[]): Promise<void> {
    const adapter = RailsApplication.jobAdapter;
    if (!adapter) {
      setImmediate(() => {
        void this.perform(...args);
      });
      return;
    }

    await adapter.enqueue(this.constructor.name, args);
  }
}
