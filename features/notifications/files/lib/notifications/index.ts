import {
  broadcastNotificationsCenter,
  buildSseConnectedPayload,
  countUnread,
  listNotifications,
  loadNotificationsCenterPayload,
  markAllNotificationsRead,
  markNotificationRead,
  sendNotification,
  sendNotificationSafe,
} from "./notificationService";
import { publishSseToUser, subscribeUserSse, unsubscribeUserSse } from "./sseHub";

export type {
  NotificationData,
  NotificationDto,
  NotificationType,
  SendNotificationInput,
  SendNotificationResult,
} from "./types";

export {
  broadcastNotificationsCenter,
  buildSseConnectedPayload,
  countUnread,
  listNotifications,
  loadNotificationsCenterPayload,
  markAllNotificationsRead,
  markNotificationRead,
  publishSseToUser,
  sendNotification,
  sendNotificationSafe,
  subscribeUserSse,
  unsubscribeUserSse,
};

export type { NotificationsCenterPayload } from "./notificationService";

export const notifications = {
  send: sendNotification,
  sendSafe: sendNotificationSafe,
  list: listNotifications,
  unreadCount: countUnread,
  markRead: markNotificationRead,
  markAllRead: markAllNotificationsRead,
  sse: {
    subscribe: subscribeUserSse,
    unsubscribe: unsubscribeUserSse,
    publish: publishSseToUser,
    connectedPayload: buildSseConnectedPayload,
    broadcastCenter: broadcastNotificationsCenter,
  },
};
