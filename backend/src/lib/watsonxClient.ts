/**
 * watsonx.ai Client — IBM Granite
 *
 * Wraps the watsonx.ai chat REST API directly (no SDK dependency on
 * ibm-watson for the generation path — the REST API is stable and avoids
 * the version mismatch issues that can surface during a demo install).
 *
 * Uses /ml/v1/text/chat rather than the older /ml/v1/text/generation:
 * the latter is deprecated, and newer Granite models (e.g. granite-4-h-small)
 * are tuned for the chat message format — they return terse, unreliable
 * completions when driven through the raw completion endpoint.
 *
 * API reference:
 *   https://cloud.ibm.com/apidocs/watsonx-ai#text-chat
 *
 * Required environment variables:
 *   WATSONX_API_KEY      — IBM Cloud IAM API key
 *   WATSONX_PROJECT_ID   — watsonx.ai project ID
 *   WATSONX_URL          — regional endpoint, e.g. https://us-south.ml.cloud.ibm.com
 *   WATSONX_MODEL_ID     — model to use, e.g. ibm/granite-4-h-small
 */

const WATSONX_URL    = process.env.WATSONX_URL        ?? 'https://us-south.ml.cloud.ibm.com';
const MODEL_ID       = process.env.WATSONX_MODEL_ID   ?? 'ibm/granite-13b-instruct-v2';
const PROJECT_ID     = process.env.WATSONX_PROJECT_ID ?? '';
const IAM_TOKEN_URL  = 'https://iam.cloud.ibm.com/identity/token';

// ── IAM token cache (tokens are valid for ~60 minutes) ───────────────────────

let _iamToken: string | null = null;
let _iamExpiry = 0;

async function getIamToken(): Promise<string> {
  if (_iamToken && Date.now() < _iamExpiry) {
    return _iamToken;
  }

  const apiKey = process.env.WATSONX_API_KEY;
  if (!apiKey) {
    throw new Error(
      'WATSONX_API_KEY environment variable is not set. ' +
      'Add it to backend/.env before ingesting documents.'
    );
  }

  const body = new URLSearchParams({
    grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
    apikey: apiKey,
  });

  const response = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(
      `[watsonxClient] IAM token request FAILED\n` +
      `  URL: ${IAM_TOKEN_URL}\n` +
      `  Status: ${response.status} ${response.statusText}\n` +
      `  Body: ${text}`
    );
    throw new Error(`IBM IAM token request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  _iamToken = data.access_token;
  // Refresh 5 minutes before expiry
  _iamExpiry = Date.now() + (data.expires_in - 300) * 1000;

  return _iamToken;
}

// ── Generation parameters ─────────────────────────────────────────────────────

export interface GenerateParams {
  /** The full prompt string */
  prompt: string;
  /** Maximum tokens to generate. Default 2048 */
  maxNewTokens?: number;
  /** Temperature (0 = deterministic). Default 0 for fact-extraction */
  temperature?: number;
  /** Top-P nucleus sampling. Default 1 */
  topP?: number;
  /** Stop sequences */
  stopSequences?: string[];
}

export interface GenerateResult {
  text: string;
  stopReason: string;
  inputTokenCount: number;
  generatedTokenCount: number;
}

const JSON_ONLY_SYSTEM_PROMPT =
  'Respond only with valid JSON. No preamble, no markdown fences, no explanation.';

/**
 * Call the watsonx.ai chat endpoint with the prompt as a single user message.
 * Returns the generated text string, in the same shape the old completion-based
 * generate() returned, so callers don't need to change.
 */
export async function generate(params: GenerateParams): Promise<GenerateResult> {
  const token = await getIamToken();

  const url = `${WATSONX_URL}/ml/v1/text/chat?version=2023-05-29`;

  const requestBody = {
    model_id: MODEL_ID,
    project_id: PROJECT_ID,
    messages: [
      { role: 'system', content: JSON_ONLY_SYSTEM_PROMPT },
      { role: 'user', content: params.prompt },
    ],
    max_tokens:  params.maxNewTokens ?? 2048,
    temperature: params.temperature  ?? 0,
    top_p:       params.topP         ?? 1,
    stop:        params.stopSequences ?? [],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(
      `[watsonxClient] Chat request FAILED\n` +
      `  URL: ${url}\n` +
      `  Model: ${MODEL_ID}\n` +
      `  Project: ${PROJECT_ID}\n` +
      `  Status: ${response.status} ${response.statusText}\n` +
      `  Body: ${text}`
    );
    throw new Error(`watsonx.ai chat request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices: Array<{
      message: { role: string; content: string };
      finish_reason: string;
    }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
    };
  };

  const choice = data.choices[0];
  return {
    text: choice.message.content.trim(),
    stopReason: choice.finish_reason,
    inputTokenCount: data.usage.prompt_tokens,
    generatedTokenCount: data.usage.completion_tokens,
  };
}
