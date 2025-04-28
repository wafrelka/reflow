import { describe, it, expect } from "vitest";

import { parseRepository } from "./event";

describe("parseRepository", () => {
  it("returns parsed repository", () => {
    const input = "foo/bar";
    const expected = { owner: "foo", name: "bar" };
    expect(parseRepository(input)).toEqual(expected);
  });

  it("returns undefined for invalid input", () => {
    const input = "foo-bar";
    const expected = undefined;
    expect(parseRepository(input)).toEqual(expected);
  });
});
