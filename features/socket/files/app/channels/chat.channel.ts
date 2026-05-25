import { ApplicationChannel } from "./application.channel";

/**
 * Demo chat room — works for guests; uses session user id in display name when logged in.
 */
export class ChatChannel extends ApplicationChannel {
  async subscribe(): Promise<void> {
    this.join("chat_room");

    const displayName = this.displayName();

    this.socket.on("chat:message", (data: unknown) => {
      const content =
        typeof data === "object" && data && "content" in data
          ? String((data as { content: unknown }).content).trim()
          : String(data ?? "").trim();
      if (!content || content.length > 500) return;

      this.broadcastTo("chat_room", "chat:message", {
        user: { name: displayName },
        content,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private displayName(): string {
    const userId = this.getSessionUserId();
    if (userId) return `User ${userId.slice(0, 8)}`;
    return `Guest ${this.socket.id.slice(0, 6)}`;
  }
}
