import type { SQSHandler, SQSRecord } from "aws-lambda";
import { App, type Octokit } from "octokit";
import { minimatch } from "minimatch";
import { z } from "zod";
import assert from "node:assert";

import { extractManifest } from "./lib/manifest";
import { parseRepository, RepositoryEvent } from "./lib/event";
import { fetchSecret, loadConfigFromLambdaEnv } from "./lib/aws";
import { fetchActiveWorkflows, fetchDefaultBranch } from "./lib/github";

const secretConfig = loadConfigFromLambdaEnv();

const { GH_APP_ID, GH_APP_PRIVATE_KEY_SECRET_ID, WORKFLOW_REPOSITORY } = process.env;
assert(GH_APP_ID !== undefined, "`GH_APP_ID` must be set");
assert(GH_APP_PRIVATE_KEY_SECRET_ID !== undefined, "`GH_APP_PRIVATE_KEY_SECRET_ID` must be set");
assert(WORKFLOW_REPOSITORY !== undefined, "`WORKFLOW_REPOSITORY` must be set");

const PARSED_WORKFLOW_REPOSITORY = parseRepository(WORKFLOW_REPOSITORY);
assert(
  PARSED_WORKFLOW_REPOSITORY !== undefined,
  "`WORKFLOW_REPOSITORY` must be of form '<owner>/<name>'",
);

const GitHubPushEvent = z.object({
  ref: z.string(),
});
type GitHubPushEvent = z.infer<typeof GitHubPushEvent>;

type WorkflowSource = {
  owner: string;
  name: string;
  ref: string;
};

export const handleEvent = async (
  event: RepositoryEvent,
  src: WorkflowSource,
  octokit: Octokit,
) => {
  if (event.type !== "push") {
    return;
  }
  const { data: pushData, error } = GitHubPushEvent.safeParse(event.data);
  if (error) {
    console.warn(`malformed push event payload: ${error}`);
    return;
  }

  const workflows = await fetchActiveWorkflows(src.owner, src.name, octokit);
  console.log(`active workflows: ${workflows.map((w) => w.name).join(", ")}`);

  for (const workflow of workflows) {
    const manifest = extractManifest(workflow.config);
    if (manifest === undefined) {
      continue;
    }
    if (manifest instanceof Error) {
      console.warn(`error while parsing workflow config: ${workflow.name} ${manifest}`);
      continue;
    }

    if (
      event.repository === manifest.repository &&
      manifest.pushTargets.some((p) => minimatch(pushData.ref, p))
    ) {
      console.log(`invoking workflow '${workflow.name}'`);
      await octokit.rest.actions.createWorkflowDispatch({
        owner: src.owner,
        repo: src.name,
        ref: src.ref,
        workflow_id: workflow.id,
      });
    }
  }
};

const handleRecord = async (record: SQSRecord, src: WorkflowSource, octokit: Octokit) => {
  const id = record.messageId;
  const body = record.body;
  console.log(`processing event '${id}'`);

  let event: RepositoryEvent;
  try {
    event = RepositoryEvent.parse(JSON.parse(body));
  } catch (error) {
    console.error(`malformed event payload: ${error} (id = ${id})`);
    return;
  }

  try {
    await handleEvent(event, src, octokit);
  } catch (error) {
    console.error(`could not process event: ${error} (id = ${id})`);
    return;
  }

  console.log(`event '${id}' is processed successfully`);
};

export const handler: SQSHandler = async (event, context) => {
  const { owner, name } = PARSED_WORKFLOW_REPOSITORY;

  const privateKey = await fetchSecret(GH_APP_PRIVATE_KEY_SECRET_ID, secretConfig);
  const app = new App({ appId: GH_APP_ID, privateKey });
  const { data } = await app.octokit.rest.apps.getRepoInstallation({ owner, repo: name });
  const octokit = await app.getInstallationOctokit(data.id);

  const defaultBranch = await fetchDefaultBranch(owner, name, octokit);
  const src = {
    owner,
    name,
    ref: `refs/heads/${defaultBranch}`,
  };

  await Promise.all(event.Records.map((record) => handleRecord(record, src, octokit)));
};
