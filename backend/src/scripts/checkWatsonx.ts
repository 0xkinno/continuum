/**
 * watsonx.ai connection health check.
 *
 * Verifies, in order:
 *   1. IAM token exchange succeeds (API key is valid)
 *   2. The configured WATSONX_MODEL_ID is actually available in this
 *      project/region (catches deprecated/retired/region-mismatched models)
 *   3. A real text-generation call against that model succeeds
 *
 * Usage: npm run check:watsonx
 */

import 'dotenv/config';

const WATSONX_URL = process.env.WATSONX_URL ?? '';
const MODEL_ID = process.env.WATSONX_MODEL_ID ?? '';
const PROJECT_ID = process.env.WATSONX_PROJECT_ID ?? '';
const API_KEY = process.env.WATSONX_API_KEY ?? '';
const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';

async function main() {
  console.log('=== watsonx.ai connection check ===');
  console.log('WATSONX_URL:       ', WATSONX_URL || '(not set)');
  console.log('WATSONX_MODEL_ID:  ', MODEL_ID || '(not set)');
  console.log('WATSONX_PROJECT_ID:', PROJECT_ID || '(not set)');
  console.log('WATSONX_API_KEY:   ', API_KEY ? `set (${API_KEY.length} chars)` : '(not set)');

  if (!WATSONX_URL || !MODEL_ID || !PROJECT_ID || !API_KEY) {
    console.error('\n✗ One or more required environment variables are missing. Check backend/.env.');
    process.exit(1);
  }

  // ── Step 1: IAM token ────────────────────────────────────────────────────
  console.log('\n[1/3] Requesting IAM token...');
  const iamRes = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: API_KEY,
    }).toString(),
  });

  if (!iamRes.ok) {
    console.error(`✗ IAM token request failed (${iamRes.status}): ${await iamRes.text()}`);
    process.exit(1);
  }
  const { access_token: token } = (await iamRes.json()) as { access_token: string };
  console.log('✓ IAM token acquired.');

  // ── Step 2: Is the configured model available in this project/region? ──
  console.log(`\n[2/3] Checking whether "${MODEL_ID}" is available in ${WATSONX_URL}...`);
  const specsRes = await fetch(`${WATSONX_URL}/ml/v1/foundation_model_specs?version=2023-05-29`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (specsRes.ok) {
    const specsData = (await specsRes.json()) as { resources?: Array<{ model_id: string }> };
    const ids = (specsData.resources ?? []).map((r) => r.model_id);
    if (ids.includes(MODEL_ID)) {
      console.log('✓ Model is available in this project/region.');
    } else {
      const graniteIds = ids.filter((id) => id.includes('granite'));
      console.error(`✗ "${MODEL_ID}" is NOT in this project's available model list.`);
      console.error(`  Granite models actually available here: ${graniteIds.join(', ') || '(none)'}`);
    }
  } else {
    console.error(`  (Could not fetch model list: ${specsRes.status} ${await specsRes.text()})`);
  }

  // ── Step 3: Real generation call ────────────────────────────────────────
  console.log('\n[3/3] Sending a test generation request...');
  const genRes = await fetch(`${WATSONX_URL}/ml/v1/text/generation?version=2023-05-29`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model_id: MODEL_ID,
      project_id: PROJECT_ID,
      input: 'Reply with the single word: OK',
      parameters: { max_new_tokens: 10, temperature: 0, top_p: 1 },
    }),
  });

  const genBodyText = await genRes.text();
  if (!genRes.ok) {
    console.error(`✗ Generation call failed (${genRes.status} ${genRes.statusText})`);
    console.error(`  Body: ${genBodyText}`);
    process.exit(1);
  }

  console.log(`✓ Generation call succeeded (${genRes.status}).`);
  console.log(`  Body: ${genBodyText}`);
  console.log('\n=== All checks passed ===');
}

main().catch((err) => {
  console.error('\n✗ Unexpected error during health check:', err);
  process.exit(1);
});
