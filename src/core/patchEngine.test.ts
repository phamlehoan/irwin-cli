import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  applyOp,
  applyPatches,
  bootstrapPatchTargetContent,
} from "./patchEngine";

describe("patchEngine", () => {
  it("insertAfter marker", () => {
    const src = "// @irwin:routes-draw\n    this.get('/');\n";
    const { content, applied } = applyOp(src, {
      type: "insertAfter",
      marker: "// @irwin:routes-draw",
      content: '    this.path("/api", ApiRoute.draw());\n',
    });
    assert.equal(applied, true);
    assert.match(content, /ApiRoute\.draw/);
  });

  it("returns not applied when marker missing", () => {
    const { applied } = applyOp("no markers", {
      type: "insertAfter",
      marker: "// @irwin:missing",
      content: "x",
    });
    assert.equal(applied, false);
  });

  it("skipIfContains prevents duplicate schema fields", () => {
    const schema = `  email String @unique
  phoneNumber String?
  status String
`;
    const { content, applied } = applyOp(schema, {
      type: "insertBefore",
      marker: "  status String",
      skipIfContains: "phoneNumber",
      content: "\n  phoneNumber String?\n",
    });
    assert.equal(applied, false);
    assert.equal(content, schema);
  });

  it("bootstrapPatchTargetContent for lib/index.ts", () => {
    const content = bootstrapPatchTargetContent("lib/index.ts", []);
    assert.match(content ?? "", /@irwin:lib-exports/);
  });

  it("applyPatches fixes empty lib/index.ts without marker", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-patch-"));
    fs.mkdirSync(path.join(root, "lib"), { recursive: true });
    fs.writeFileSync(path.join(root, "lib/index.ts"), "", "utf8");

    const results = applyPatches(
      root,
      [
        {
          file: "lib/index.ts",
          ops: [
            {
              type: "insertAfter",
              marker: "// @irwin:lib-exports",
              content: '\nexport * from "./utils/storage";\n',
            },
          ],
        },
      ],
      false,
    );

    assert.equal(results[0]?.applied, 1);
    const written = fs.readFileSync(path.join(root, "lib/index.ts"), "utf8");
    assert.match(written, /@irwin:lib-exports/);
    assert.match(written, /utils\/storage/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("skipIfContains prevents duplicate ApiV1 mount when auth-api then ai", () => {
    let apiIndex = `import { checkReadiness } from "@configs/plugins/health";
import { ApiV1Route } from "./v1";

export class ApiRoute extends RailsRoute {
  public draw() {
    this.get("/health", async (_req, res) => {
      res.status(200).json({});
    });

    this.path("/v1", ApiV1Route.draw());
  }
}
`;
    const aiApiPatches = [
      {
        type: "insertAfter" as const,
        marker: "import { checkReadiness } from \"@configs/plugins/health\";",
        skipIfContains: "ApiV1Route",
        content: '\nimport { ApiV1Route } from "./v1";',
      },
      {
        type: "insertBefore" as const,
        marker: "  }\n}",
        skipIfContains: "ApiV1Route.draw()",
        content: '\n    this.path("/v1", ApiV1Route.draw());',
      },
    ];
    for (const op of aiApiPatches) {
      const next = applyOp(apiIndex, op);
      apiIndex = next.content;
      assert.equal(next.applied, false);
    }
    const matches = apiIndex.match(/ApiV1Route\.draw\(\)/g);
    assert.equal(matches?.length, 1);
  });

  it("applyPatches creates missing lib/index.ts then patches", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "irwin-patch-"));
    const patches = [
      {
        file: "lib/index.ts",
        ops: [
          {
            type: "insertAfter" as const,
            marker: "// @irwin:lib-exports",
            content: '\nexport * from "./ai";\n',
          },
        ],
      },
    ];
    const results = applyPatches(root, patches, false);
    assert.equal(results[0]?.created, true);
    assert.equal(results[0]?.applied, 1);
    const written = fs.readFileSync(path.join(root, "lib/index.ts"), "utf8");
    assert.match(written, /@irwin:lib-exports/);
    assert.match(written, /export \* from "\.\/ai"/);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
