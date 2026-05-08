import { describe, it, expect } from "vitest";

import { extractManifest, matchManifest, type ReflowManifest } from "./manifest";

describe("extractManifest", () => {
  it("parses workflow config", () => {
    const input = `
      # reflow: repository=foo/bar push=refs/heads/master
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushes: ["refs/heads/master"] }],
    };
    expect(extractManifest(input)).toEqual(expected);
  });

  it("parses workflow config with multiple push targets", () => {
    const input = `
      # reflow: repository=foo/bar push=refs/heads/master,refs/heads/develop
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushes: ["refs/heads/master", "refs/heads/develop"] }],
    };
    expect(extractManifest(input)).toEqual(expected);
  });

  it("parses workflow config with multiple triggers", () => {
    const input = `
      # reflow: repository=foo/bar push=refs/heads/master,refs/heads/develop
      # reflow: repository=baz/qux push=refs/heads/main,refs/heads/dev
      on: {workflow_dipatch: {}}
      jobs: []
    `;
    const expected: ReflowManifest = {
      triggers: [
        { repository: "foo/bar", pushes: ["refs/heads/master", "refs/heads/develop"] },
        { repository: "baz/qux", pushes: ["refs/heads/main", "refs/heads/dev"] },
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
      # reflow: repository=foo/bar push=refs/heads/master
      jobs: []
    `;
    const expected: ReflowManifest = { triggers: [] };
    expect(extractManifest(input)).toEqual(expected);
  });

  it("returns Error if repository is missing", () => {
    const input = `
      # reflow: push=refs/heads/master
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
      triggers: [{ repository: "foo/bar", pushes: ["refs/heads/master", "refs/heads/develop"] }],
    };
    const repo = "foo/bar";
    const ref = "refs/heads/master";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns false when repository is different", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushes: ["refs/heads/master", "refs/heads/develop"] }],
    };
    const repo = "baz/qux";
    const ref = "refs/heads/master";
    const expected = false;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns false when ref is different", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushes: ["refs/heads/master", "refs/heads/develop"] }],
    };
    const repo = "foo/bar";
    const ref = "refs/heads/wip";
    const expected = false;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns false when no triggers found", () => {
    const manifest: ReflowManifest = { triggers: [] };
    const repo = "foo/bar";
    const ref = "refs/heads/master";
    const expected = false;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns true when second trigger matches", () => {
    const manifest: ReflowManifest = {
      triggers: [
        { repository: "baz/qux", pushes: ["refs/heads/main"] },
        { repository: "foo/bar", pushes: ["refs/heads/master"] },
      ],
    };
    const repo = "foo/bar";
    const ref = "refs/heads/master";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns true when push target contains glob", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushes: ["refs/heads/releases/*"] }],
    };
    const repo = "foo/bar";
    const ref = "refs/heads/releases/v1";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns false when push target contains unmatched glob", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushes: ["refs/heads/releases/*"] }],
    };
    const repo = "foo/bar";
    const ref = "refs/heads/releases/dev/v1";
    const expected = false;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns true when push target contains globstar matching single component", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushes: ["refs/heads/releases/**/*"] }],
    };
    const repo = "foo/bar";
    const ref = "refs/heads/releases/v1";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });

  it("returns true when push target contains globstar matching multiple components", () => {
    const manifest: ReflowManifest = {
      triggers: [{ repository: "foo/bar", pushes: ["refs/heads/releases/**/*"] }],
    };
    const repo = "foo/bar";
    const ref = "refs/heads/releases/dev/v1";
    const expected = true;
    expect(matchManifest(manifest, repo, ref)).toEqual(expected);
  });
});
