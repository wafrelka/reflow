import { minimatch } from "minimatch";

type KeyValuePair = {
  key: string;
  value: string | undefined;
};

const parseKeyValuePairs = (text: string): KeyValuePair[] => {
  const chunks = text.split(" ").filter((chunk) => chunk.length > 0);
  return chunks
    .map((chunk) => chunk.split(/=(.*)/s))
    .map(([key, value]) => ({ key: key ?? "", value }));
};

export type ReflowTrigger = {
  repository: string;
  pushTargets: string[];
};

export type ReflowManifest = {
  triggers: ReflowTrigger[];
};

export const extractTrigger = (line: string): ReflowTrigger | undefined | Error => {
  const match = line.match(/^\s*#\s*reflow:([^\n]+)$/);
  if (!match || !match[1]) {
    return undefined;
  }
  const config = match[1];
  const pairs = new Map(parseKeyValuePairs(config).map(({ key, value }) => [key, value] as const));

  const repository = pairs.get("repository") ?? pairs.get("repo");
  if (!repository) {
    return new Error("repository not specified");
  }

  const pushTargets = pairs.get("push")?.split(",");
  if (!pushTargets) {
    return new Error("push target not specified");
  }

  return { repository, pushTargets };
};

export const extractManifest = (workflowConfig: string): ReflowManifest | Error => {
  const triggers: ReflowTrigger[] = [];

  const lines = workflowConfig.split("\n").map((l) => l.trim());
  for (const line of lines.filter((l) => l.length > 0)) {
    const trigger = extractTrigger(line);
    if (trigger === undefined) {
      break;
    }
    if (trigger instanceof Error) {
      return trigger;
    }
    triggers.push(trigger);
  }
  return { triggers };
};

export const matchManifest = (
  manifest: ReflowManifest,
  repository: string,
  ref: string,
): boolean => {
  const match = (t: ReflowTrigger): boolean =>
    repository === t.repository && t.pushTargets.some((p) => minimatch(ref, p));
  return manifest.triggers.some(match);
};
