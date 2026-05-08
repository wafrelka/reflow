import { describe, it, expect } from "vitest";

import { extractManifest, matchManifest, type ReflowManifest } from "./manifest";

describe("extractManifest", () => {
  it("parses workflow config", () => {
    const input = `
      # reflow: repository=foo/bar push=master
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushTargets: ["master"] }],
    };
    expect(extractManifest(input)).toEqual(expected);
  });

  it("parses workflow config with multiple push targets", () => {
    const input = `
      # reflow: repository=foo/bar push=master,develop
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushTargets: ["master", "develop"] }],
    };
    expect(extractManifest(input)).toEqual(expected);
  });

  it("parses workflow config with multiple triggers", () => {
    const input = `
      # reflow: repository=foo/bar push=master,develop
      # reflow: repository=baz/qux push=main,dev
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected: ReflowManifest = {
      triggers: [
        { repository: "foo/bar", pushTargets: ["master", "develop"] },
        { repository: "baz/qux", pushTargets: ["main", "dev"] },
      ],
    };
    expect(extractManifest(input)).toEqual(expected);
  });

  it("ignores workflow config without manifest", () => {
    const input = `
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected: ReflowManifest = { triggers: [] };
    expect(extractManifest(input)).toEqual(expected);
  });

  it("ignores manifest in the middle of workflow config", () => {
    const input = `
      on: {workflow_dipatch: {}}
      # reflow: repository=foo/bar push=master
      jobs: []
    `;
    const expected: ReflowManifest = { triggers: [] };
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

describe("matchManifest", () => {
  it("returns true when matching found", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushTargets: ["master", "develop"] }],
    };
    const repo = "foo/bar";
    const ref = "master";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns false when repository is different", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushTargets: ["master", "develop"] }],
    };
    const repo = "baz/qux";
    const ref = "master";
    const expected = false;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns false when ref is different", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushTargets: ["master", "develop"] }],
    };
    const repo = "foo/bar";
    const ref = "wip";
    const expected = false;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns false when no triggers found", () => {
    const manifest: ReflowManifest = { triggers: [] };
    const repo = "foo/bar";
    const ref = "master";
    const expected = false;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns true when second trigger matches", () => {
    const manifest: ReflowManifest = {
      triggers: [
        { repository: "baz/qux", pushTargets: ["main"] },
        { repository: "foo/bar", pushTargets: ["master"] },
      ],
    };
    const repo = "foo/bar";
    const ref = "master";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns true when push target contains glob", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushTargets: ["releases/*"] }],
    };
    const repo = "foo/bar";
    const ref = "releases/v1";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns false when push target contains unmatched glob", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushTargets: ["releases/*"] }],
    };
    const repo = "foo/bar";
    const ref = "releases/dev/v1";
    const expected = false;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns true when push target contains globstar matching single component", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushTargets: ["releases/**/*"] }],
    };
    const repo = "foo/bar";
    const ref = "releases/v1";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns true when push target contains globstar matching multiple components", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushTargets: ["releases/**/*"] }],
    };
    const repo = "foo/bar";
    const ref = "releases/dev/v1";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });
});
