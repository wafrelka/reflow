import { z } from "zod";

export type ParametersSecretsExtensionConfig = {
  baseUrl: string;
  token: string;
};

const GetParameterResponse = z.object({ Parameter: z.object({ Value: z.string() }) });
type GetParameterResponse = z.infer<typeof GetParameterResponse>;

const PARAMETERS_SECRETS_EXTENSION_TOKEN_HEADER_NAME = "X-Aws-Parameters-Secrets-Token";
const DEFAULT_PARAMETERS_SECRETS_EXTENSION_HTTP_PORT = "2773";

export const loadExtensionConfigFromLambdaEnv = (): ParametersSecretsExtensionConfig => {
  const { PARAMETERS_SECRETS_EXTENSION_HTTP_PORT, AWS_SESSION_TOKEN } = process.env;
  if (AWS_SESSION_TOKEN === undefined) {
    throw new Error("`AWS_SESSION_TOKEN` must be set");
  }

  const port =
    PARAMETERS_SECRETS_EXTENSION_HTTP_PORT || DEFAULT_PARAMETERS_SECRETS_EXTENSION_HTTP_PORT;
  const baseUrl = `http://localhost:${port}`;
  return { baseUrl, token: AWS_SESSION_TOKEN };
};

// Fetch a parameter via Parameters and Secrets Lambda Extension
export const fetchParameter = async (
  name: string,
  config: ParametersSecretsExtensionConfig,
): Promise<string> => {
  const { baseUrl, token } = config;

  const url = new URL(`${baseUrl}/systemsmanager/parameters/get`);
  url.searchParams.append("name", name);
  url.searchParams.append("withDecryption", "true");
  const headers = { [PARAMETERS_SECRETS_EXTENSION_TOKEN_HEADER_NAME]: token };

  console.log(`fetching parameter from extension (url = ${url})`);
  const resp = await fetch(url, { headers });

  if (!resp.ok) {
    const text = await resp.text();
    throw Error(`unexpected response from extension: ${resp.status} ${text}`);
  }
  const raw = await resp.json();
  const { data, error, success } = GetParameterResponse.safeParse(raw);
  if (!success) {
    throw Error(`malformed response from extension: ${error}`);
  }

  return data.Parameter.Value;
};
