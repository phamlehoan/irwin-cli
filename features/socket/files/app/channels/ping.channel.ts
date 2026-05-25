import { ApplicationChannel } from "./application.channel";

/** Public echo channel — no login required. */
export class PingChannel extends ApplicationChannel {
  subscribe(): void {
    this.socket.on("ping:client", (payload: unknown) => {
      this.socket.emit("ping:server", {
        ok: true,
        echo: payload ?? null,
        at: new Date().toISOString(),
      });
    });
  }
}
