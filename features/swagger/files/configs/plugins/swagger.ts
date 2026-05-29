import env from "@configs/env";
import type { Express } from "express";
import { getSwaggerDocs, setSwaggerDocument, setupSwaggerUI } from "ts-rails";

let swaggerInitialized = false;

/** Gọi trong `runInitializers()` — trước khi `bootstrap()` đăng ký route Swagger. */
export function initSwaggerDocument(): void {
  if (swaggerInitialized) return;
  swaggerInitialized = true;

  setSwaggerDocument({
    openapi: "3.0.0",
    info: {
      title: "Irwin API",
      version: "1.0.0",
      description: "OpenAPI documentation for JSON API routes under /api",
    },
    servers: [
      {
        url: `http://localhost:${env.port}/api/v1`,
        description: "API base",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token from POST /api/v1/auth/login",
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {},
  });
}

export function setupSwagger(app: Express): void {
  initSwaggerDocument();
  setupSwaggerUI(app, getSwaggerDocs);
}
