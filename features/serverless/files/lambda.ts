import serverless from "serverless-http";
import application from "./configs/application";

// Cached across warm invocations. (Was `let handler` + `export const handler`: redeclared in the same scope.)
let cachedHandler: ReturnType<typeof serverless> | undefined;

export const handler = async (event: unknown, context: unknown) => {
  if (!cachedHandler) {
    await application.initialize();
    cachedHandler = serverless(application.app);
  }
  return cachedHandler(event as object, context as object);
};
