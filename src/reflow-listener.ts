import assert from "node:assert";
import { SQSClient, SendMessageCommand, type SendMessageCommandInput } from "@aws-sdk/client-sqs";
import { Webhooks } from "@octokit/webhooks";
import type { LambdaFunctionURLHandler } from "aws-lambda";
import { z } from "zod";

import type { RepositoryEvent } from "./lib/event";
import { fetchSecret, loadConfigFromLambdaEnv } from "./lib/aws";

const secretConfig = loadConfigFromLambdaEnv();
const { WEBHOOK_SECRET_SECRET_ID, SQS_QUEUE_URL } = process.env;
assert(WEBHOOK_SECRET_SECRET_ID !== undefined, "`WEBHOOK_SECRET_SECRET_ID` must be set");

const GitHubPushEvent = z.object({
  ref: z.string(),
  repository: z.object({
    full_name: z.string(),
    default_branch: z.string(),
  }),
});
type GitHubPushEvent = z.infer<typeof GitHubPushEvent>;

const SQS_CLIENT = new SQSClient();
const SQS_MESSAGE_GROUP_ID = "default";

export const handler: LambdaFunctionURLHandler = async (event, context) => {
  const body = event.body ?? "";
  const sig = event.headers["x-hub-signature-256"];
  if (sig === undefined) {
    return { statusCode: 403, body: "signature missing\n" };
  }

  const secret = await fetchSecret(WEBHOOK_SECRET_SECRET_ID, secretConfig);
  const webhooks = new Webhooks({ secret });

  const ok = await webhooks.verify(body, sig);
  if (!ok) {
    return { statusCode: 403, body: "invalid signature\n" };
  }

  const eventType = event.headers["x-github-event"];
  if (eventType !== "push") {
    return { statusCode: 200, body: "ok (non-push event)\n" };
  }

  const eventId = event.headers["x-github-delivery"];
  if (eventId === undefined) {
    return { statusCode: 400, body: "no event id given\n" };
  }

  console.log(`event received: ${body}`);

  let push: GitHubPushEvent;
  try {
    push = GitHubPushEvent.parse(JSON.parse(body));
  } catch (error) {
    console.error(`could not parse event payload: ${error}`);
    return { statusCode: 400, body: "invalid event payload\n" };
  }

  const repoEvent: RepositoryEvent = {
    type: eventType,
    id: eventId,
    repository: push.repository.full_name,
    data: JSON.parse(body),
  };

  if (SQS_QUEUE_URL !== undefined) {
    console.log(`sending SQS message to ${SQS_QUEUE_URL}`);
    const params: SendMessageCommandInput = {
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(repoEvent),
      MessageGroupId: SQS_MESSAGE_GROUP_ID,
      MessageDeduplicationId: context.awsRequestId,
    };
    await SQS_CLIENT.send(new SendMessageCommand(params));
    console.log("SQS message sent");
  }

  return { statusCode: 200, body: "ok\n" };
};
