import { ApplicationController } from "./application.controller";
import {
  getHomeFeatureRows,
  getHomeFeatureSummary,
} from "@lib/irwin/homeFeatures";

export class HomeController extends ApplicationController {
  async index() {
    const featureRows = getHomeFeatureRows();
    const featureSummary = getHomeFeatureSummary();

    this.render("home.view/index", {
      title: "{{appTitle}}",
      featureRows,
      featureSummary,
    });
  }
}
