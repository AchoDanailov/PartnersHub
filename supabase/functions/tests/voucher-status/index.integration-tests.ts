// Integration tests: run against the local stack started by `npx supabase start`
// (migrations + supabase/seeding/seed.sql) with the function served by
// `npx supabase functions serve`. CI exports the env variables read below.
//
// Only seeded vouchers are read; nothing is written.
import assert from "node:assert/strict";

const FUNCTIONS_URL = requireEnv("SUPABASE_FUNCTIONS_URL");
const PUBLISHABLE_KEY = requireEnv("SUPABASE_PUBLISHABLE_KEY");

const ENDPOINT = `${FUNCTIONS_URL}/voucher-status`;
/** Seeded: Масаж, active, expires in 90 days. */
const VALID_QR_TOKEN = "a7000000-0000-4000-8000-000000000001";
/** Seeded: Масаж, used by alpine-staff-1. */
const USED_QR_TOKEN = "a7000000-0000-4000-8000-000000000002";

Deno.test("anyone with the publishable key reads a voucher's state", async () => {
  const valid = await checkStatus(VALID_QR_TOKEN, PUBLISHABLE_KEY);
  const used = await checkStatus(USED_QR_TOKEN, PUBLISHABLE_KEY);

  assert.equal(valid.status, 200);
  const { voucher } = await valid.json();
  assert.equal(voucher.state, "valid");
  assert.equal(voucher.serviceName, "Масаж");
  assert.equal("redemption_code" in voucher, false);

  assert.equal(used.status, 200);
  assert.equal((await used.json()).voucher.state, "used");
});

Deno.test("an unknown QR token answers 404", async () => {
  const response = await checkStatus(crypto.randomUUID(), PUBLISHABLE_KEY);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "VOUCHER_NOT_FOUND");
});

Deno.test("a request without the publishable key is rejected", async () => {
  const response = await checkStatus(VALID_QR_TOKEN, null);
  await response.body?.cancel();
  assert.equal(response.status, 401);
});

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `${name} is not set. Start the local stack and export its values (see the edge-functions skill).`,
    );
  }
  return value;
}

function checkStatus(
  qrToken: string,
  apikey: string | null,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apikey) headers.apikey = apikey;
  return fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ qrToken }),
  });
}
