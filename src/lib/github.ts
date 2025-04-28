import { Buffer } from "node:buffer";

import type { Octokit } from "octokit";

export type Workflow = {
  config: string;
  id: number;
  name: string;
};

const fetchTextFileContent = async (
  owner: string,
  repo: string,
  path: string,
  octokit: Octokit,
): Promise<string | undefined> => {
  const content = await octokit.rest.repos.getContent({ owner, repo, path });
  if (Array.isArray(content.data) || content.data.type !== "file") {
    return undefined;
  }
  const encoded = content.data.content;
  return Buffer.from(encoded, "base64").toString();
};

export const fetchActiveWorkflows = async (
  owner: string,
  repo: string,
  octokit: Octokit,
): Promise<Workflow[]> => {
  const results: Workflow[] = [];
  const workflows = await octokit.rest.actions.listRepoWorkflows({ owner, repo });
  for (const workflow of workflows.data.workflows.filter((w) => w.state === "active")) {
    const config = await fetchTextFileContent(owner, repo, workflow.path, octokit);
    if (!config) {
      continue;
    }
    results.push({ config, id: workflow.id, name: workflow.name });
  }
  return results;
};

export const fetchDefaultBranch = async (
  owner: string,
  repo: string,
  octokit: Octokit,
): Promise<string> => {
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return data.default_branch;
};
