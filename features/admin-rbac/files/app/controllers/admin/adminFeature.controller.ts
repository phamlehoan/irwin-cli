import { Prisma } from "@db";
import models from "@models";
import { NotFoundError } from "ts-rails";
import { AdminController } from "./admin.controller";

export class AdminFeatureController extends AdminController {
  async index() {
    const search = String(this.req.query.search || "").trim();
    const where: Prisma.FeatureWhereInput = { deleted: false };
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const features = await models.feature.findMany({
      where,
      include: {
        permissions: { where: { deleted: false } },
        parent: true,
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });

    this.render("admin/feature.view/index", {
      title: this.t("admin.features"),
      activeMenu: "features",
      features,
      search,
    });
  }

  async show() {
    const feature = await models.feature.findFirst({
      where: { id: this.req.params.id, deleted: false },
      include: {
        permissions: { where: { deleted: false } },
        parent: true,
        children: { where: { deleted: false } },
      },
    });
    if (!feature) throw new NotFoundError("Feature not found");

    this.render("admin/feature.view/show", {
      title: feature.name,
      activeMenu: "features",
      feature,
    });
  }
}
