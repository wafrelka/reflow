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

export type ReflowManifest = {
  repository: string;
  pushTargets: string[];
};

export const extractManifest = (workflowConfig: string): ReflowManifest | undefined | Error => {
  const match = workflowConfig.match(/^\s*#\s*reflow:([^\n]+)\n/);
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
