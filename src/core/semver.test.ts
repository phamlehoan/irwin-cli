import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSemver, semverGte } from "./semver";

describe("semver (IRW-FIX-032)", () => {
  const cases: Array<[string, string, -1 | 0 | 1]> = [
    ["1.0.9", "1.0.11", -1], // string compare gets this wrong
    ["1.10.0", "1.2.0", 1], // ... and this
    ["1.1.3", "1.1.3", 0],
    ["2.0.0", "1.99.99", 1],
    ["1.0.0-beta.1", "1.0.0", -1],
    ["1.0.0-beta.2", "1.0.0-beta.10", -1],
    ["v1.2.3", "1.2.3", 0],
    ["1.0.11", "1.0.9", 1],
    ["0.9.0", "1.0.0", -1],
    ["1.2.3+build5", "1.2.3", 0],
  ];
  for (const [a, b, expected] of cases) {
    it(`${a} vs ${b} = ${expected}`, () => {
      assert.equal(compareSemver(a, b), expected);
    });
  }

  it("semverGte skips unparsable versions instead of blocking", () => {
    assert.equal(semverGte("latest", "1.0.11"), true);
    assert.equal(semverGte("1.0.9", "1.0.11"), false);
    assert.equal(semverGte("1.10.0", "1.2.0"), true);
  });
});
