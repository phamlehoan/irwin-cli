import { countUnread, listNotifications } from "@lib/notifications";
import { NextFunction, Request, Response } from "express";
import { ApplicationMiddleware } from "./application.middleware";

/** Header bell: unread count + preview list (after CurrentUserMiddleware). */
export class NotificationNavMiddleware extends ApplicationMiddleware {
  public async execute(req: Request, res: Response, next: NextFunction) {
    const user = req.user as { id: string } | null | undefined;
    if (user?.id) {
      try {
        const [unreadNotificationCount, notificationPreview] = await Promise.all([
          countUnread(user.id),
          listNotifications(user.id, { limit: 8 }),
        ]);
        res.locals.unreadNotificationCount = unreadNotificationCount;
        res.locals.notificationPreview = notificationPreview;
      } catch {
        res.locals.unreadNotificationCount = 0;
        res.locals.notificationPreview = [];
      }
    } else {
      res.locals.unreadNotificationCount = 0;
      res.locals.notificationPreview = [];
    }
    next();
  }
}
