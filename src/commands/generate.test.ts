import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGenerateArgs } from "./generate";

describe("irwin g flag forwarding (IRW-FIX-021)", () => {
  it("forwards --api/--force/--skip/--dry-run to the local ts-rails CLI", () => {
    assert.deepEqual(buildGenerateArgs("scaffold", "Post", ["title:string"], {}), [
      "g",
      "scaffold",
      "Post",
      "title:string",
    ]);
    assert.deepEqual(
      buildGenerateArgs("resource", "Post", [], { api: true, force: true, dryRun: true }),
      ["g", "resource", "Post", "--api", "--force", "--dry-run"],
    );
    assert.deepEqual(buildGenerateArgs("controller", "Admin:User", ["index"], { skip: true }), [
      "g",
      "controller",
      "Admin:User",
      "index",
      "--skip",
    ]);
  });
});
