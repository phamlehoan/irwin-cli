import env from "@configs/env";
import type { Express } from "express";
import { getSwaggerDocs, setSwaggerDocument, setupSwaggerUI } from "ts-rails";

setSwaggerDocument({
  openapi: "3.0.0",
  info: {
    title: "Irwin API",
    version: "1.0.0",
    description: "OpenAPI documentation for this app",
  },
  servers: [
    {
      url: `http://localhost:${env.port}/api`,
      description: "API base",
    },
    {
      url: `http://localhost:${env.port}`,
      description: "App root",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: {},
});

export function setupSwagger(app: Express): void {
  setupSwaggerUI(app, getSwaggerDocs());
}
