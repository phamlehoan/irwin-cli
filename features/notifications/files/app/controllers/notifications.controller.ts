import {
  broadcastNotificationsCenter,
  countUnread,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeUserSse,
} from "@lib/notifications";
import { BeforeAction } from "ts-rails";
import { ApplicationController } from "./application.controller";

@BeforeAction("authenticateUser")
export class NotificationsController extends ApplicationController {
  async stream() {
    const userId = this.currentUser!.id;
    subscribeUserSse(userId, this.res);
    await broadcastNotificationsCenter(userId);
    return false;
  }

  async index() {
    const userId = this.currentUser!.id;
    const filter =
      String(this.req.query.filter || "all").toLowerCase() === "unread"
        ? "unread"
        : "all";
    const unreadOnly = filter === "unread";

    const [items, unreadCount] = await Promise.all([
      listNotifications(userId, { limit: 50, unreadOnly }),
      countUnread(userId),
    ]);

    this.render("notifications.view/index", {
      title: this.t("notifications.page_title"),
      notifications: items,
      unreadCount,
      filter,
    });
  }

  async read() {
    const userId = this.currentUser!.id;
    const id = String(this.req.params.id || "");
    const row = await markNotificationRead(userId, id);
    if (!row) {
      return this.res.status(404).json({ success: false, error: "Not found" });
    }
    const unreadCount = await countUnread(userId);
    return this.res.json({ success: true, notification: row, unreadCount });
  }

  async readAll() {
    const userId = this.currentUser!.id;
    await markAllNotificationsRead(userId);
    const unreadCount = await countUnread(userId);
    return this.res.json({ success: true, unreadCount });
  }
}
