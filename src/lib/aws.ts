import { z } from "zod";

export type SecretsExtensionConfig = {
  baseUrl: string;
  token: string;
};

const GetSecretResponse = z.object({ SecretString: z.string() });
type GetSecretResponse = z.infer<typeof GetSecretResponse>;

const SECRETS_EXTENSION_TOKEN_HEADER_NAME = "X-Aws-Parameters-Secrets-Token";
const DEFAULT_SECRETS_EXTENSION_HTTP_PORT = "2773";

export const loadConfigFromLambdaEnv = (): SecretsExtensionConfig => {
  const { PARAMETERS_SECRETS_EXTENSION_HTTP_PORT, AWS_SESSION_TOKEN } = process.env;
  if (AWS_SESSION_TOKEN === undefined) {
    throw new Error("`AWS_SESSION_TOKEN` must be set");
  }

  const port = PARAMETERS_SECRETS_EXTENSION_HTTP_PORT || DEFAULT_SECRETS_EXTENSION_HTTP_PORT;
  const baseUrl = `http://localhost:${port}`;
  return { baseUrl, token: AWS_SESSION_TOKEN };
};

// Fetch a secret via Parameters and Secrets Lambda Extension
export const fetchSecret = async (id: string, config: SecretsExtensionConfig): Promise<string> => {
  const { baseUrl, token } = config;

  const url = new URL(`${baseUrl}/secretsmanager/get`);
  url.searchParams.append("secretId", id);
  const headers = { [SECRETS_EXTENSION_TOKEN_HEADER_NAME]: token };

  console.log(`fetching secret from extension (url = ${url})`);
  const resp = await fetch(url, { headers });

  if (!resp.ok) {
    const text = await resp.text();
    throw Error(`unexpected response from extension: ${resp.status} ${text}`);
  }
  const raw = await resp.json();
  const { data, error, success } = GetSecretResponse.safeParse(raw);
  if (!success) {
    throw Error(`malformed response from extension: ${error}`);
  }

  return data.SecretString;
};
