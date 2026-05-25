import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from "@netlify/functions";
import serverless from "serverless-http";
import application from "../../configs/application";

type ServerlessHandler = (event: unknown, context: unknown) => Promise<unknown>;

let cached: ServerlessHandler;

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
): Promise<HandlerResponse> => {
  if (!cached) {
    await application.initialize();
    cached = serverless(application.app, {
      binary: ["image/*", "font/*", "application/pdf"],
    }) as ServerlessHandler;
  }
  context.callbackWaitsForEmptyEventLoop = false;
  return (await cached(event, context)) as HandlerResponse;
};
