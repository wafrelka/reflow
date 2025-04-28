import { describe, it, expect } from "vitest";

import { extractManifest, type ReflowManifest } from "./manifest";

describe("extractManifest", () => {
  it("parses workflow config", () => {
    const input = `
      # reflow: repository=foo/bar push=master
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected: ReflowManifest = { repository: "foo/bar", pushTargets: ["master"] };
    expect(extractManifest(input)).toEqual(expected);
  });

  it("parses workflow config with multiple push targets", () => {
    const input = `
      # reflow: repository=foo/bar push=master,develop
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected: ReflowManifest = { repository: "foo/bar", pushTargets: ["master", "develop"] };
    expect(extractManifest(input)).toEqual(expected);
  });

  it("ignores workflow config without manifest", () => {
    const input = `
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected = undefined;
    expect(extractManifest(input)).toEqual(expected);
  });

  it("returns Error if repository is missing", () => {
    const input = `
      # reflow: push=master
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected = new Error("repository not specified");
    expect(extractManifest(input)).toEqual(expected);
  });

  it("returns Error if push target is missing", () => {
    const input = `
      # reflow: repository=foo/bar
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected = new Error("push target not specified");
    expect(extractManifest(input)).toEqual(expected);
  });
});
