import models from "@models";

export abstract class ApplicationService {
  protected get models() {
    return models;
  }
}
