import env from "@configs/env";
import models from "@models";

type PushPayload = {
  title: string;
  body?: string;
  data?: Record<string, string>;
};

let firebaseReady = false;

async function getMessaging() {
  if (!env.fcmProjectId?.trim() || !env.fcmClientEmail?.trim()) {
    return null;
  }
  const admin = await import("firebase-admin");
  if (!firebaseReady) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.fcmProjectId,
          clientEmail: env.fcmClientEmail,
          privateKey: env.fcmPrivateKey,
        }),
      });
    }
    firebaseReady = true;
  }
  return admin.messaging();
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const messaging = await getMessaging();
  if (!messaging) return 0;

  const tokens = await models.userPushToken.findMany({
    where: { userId, isActive: true },
    select: { token: true },
  });
  if (tokens.length === 0) return 0;

  const message = {
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    tokens: tokens.map((t) => t.token),
  };

  const res = await messaging.sendEachForMulticast(message);
  return res.successCount;
}
