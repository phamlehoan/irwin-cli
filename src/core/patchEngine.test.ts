import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyOp } from "./patchEngine";

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
});
