import { ApplicationController } from "@controllers/application.controller";
import { appCodePath, appPath } from "@lib/utils/path";
import express from "express";
import { MiddlewareFactory, RailsApplication, setSwaggerDocument } from "ts-rails";
import env from "./env";
import { initializeCache, initializeLogger } from "./initializers";
import {
  englishLocaleMiddleware,
  rateLimitMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
} from "./plugins";
import { Route } from "./routes";

RailsApplication.middlewareFactory = {
  rateLimit: rateLimitMiddleware,
  requestId: () => requestIdMiddleware,
  requestLogging: () => requestLoggingMiddleware,
} as MiddlewareFactory;

export class Application extends RailsApplication {
  constructor() {
    super();
    this.port = env.port || "8000";
  }

  protected runInitializers() {
    setSwaggerDocument({
      openapi: "3.0.0",
      info: { title: "{{appTitle}}", version: "0.1.0" },
      paths: {},
    });
    initializeLogger();
    initializeCache();
    // @irwin:initializers
  }

  protected setupAppMiddlewares() {
    // @irwin:setup-app-middlewares
  }

  protected async setupServices() {
    // @irwin:setup-services
  }

  protected setupViewEngine() {
    this.app.set("views", appPath("views"));
    this.app.set("view engine", "pug");
  }

  protected setupStaticFiles() {
    this.app.use(express.static(appPath("assets")));
  }

  protected mountRoutes() {
    this.app.use("/", Route.draw());
  }

  public async initialize() {
    this.runInitializers();
    await this.setupServices();
    this.setupViewEngine();
    this.setupAppMiddlewares();
    this.app.use(englishLocaleMiddleware);
    // @irwin:locale-middleware
    this.setupStaticFiles();
    // @irwin:load-concerns
    this.bootstrap();
  }

  public async run() {
    await this.initialize();
    await super.run();
  }
}

export default new Application();
