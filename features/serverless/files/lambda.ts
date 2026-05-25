import serverless from "serverless-http";
import application from "./configs/application";

let handler: ReturnType<typeof serverless>;

export const handler = async (event: unknown, context: unknown) => {
  if (!handler) {
    await application.initialize();
    handler = serverless(application.app);
  }
  return handler(event, context);
};
