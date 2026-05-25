export type NotificationType = "info" | "success" | "warning" | "error" | "system";

export type NotificationData = {
  link?: string;
  entityType?: string;
  entityId?: string;
  [key: string]: unknown;
};

export type NotificationDto = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string | null;
  data: NotificationData | null;
  readAt: string | null;
  createdAt: string;
};

export type SendNotificationInput = {
  userId: string;
  type?: NotificationType;
  title: string;
  message?: string;
  data?: NotificationData | null;
  realtime?: boolean;
  push?: boolean;
};

export type SendNotificationResult = {
  notification: NotificationDto;
  sseDelivered: boolean;
  pushDelivered?: number;
};
