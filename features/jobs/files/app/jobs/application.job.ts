export abstract class ApplicationJob {
  abstract perform(...args: unknown[]): Promise<void>;

  async performLater(...args: unknown[]): Promise<void> {
    setImmediate(() => {
      void this.perform(...args);
    });
  }
}
