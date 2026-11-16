// Integration tests: run against the local stack started by `npx supabase start`
// (migrations + supabase/seeding/seed.sql) with the function served by
// `npx supabase functions serve`. CI exports the env variables read below.
//
// Seeded staff are the callers. Each test creates the vouchers it uses, so no
// seed rows are consumed and the file can be re-run locally.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../_shared/database.types.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const FUNCTIONS_URL = requireEnv("SUPABASE_FUNCTIONS_URL");
const PUBLISHABLE_KEY = requireEnv("SUPABASE_PUBLISHABLE_KEY");
const SECRET_KEY = requireEnv("SUPABASE_SECRET_KEY");

const ENDPOINT = `${FUNCTIONS_URL}/redeem-voucher`;
const PASSWORD = "password123";
const ALPINE_MASSAGE_ID = "a4000000-0000-0000-0000-000000000001";
const ALPINE_STAFF = "staff-1@alpine.example.com";
const HARBOR_STAFF = "staff-1@harbor.example.com";

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};
const admin = createClient<Database>(SUPABASE_URL, SECRET_KEY, clientOptions);

Deno.test("staff check a code and use the voucher by its QR token", async () => {
  const voucher = await createVoucher();
  const token = await signIn(ALPINE_STAFF);

  const check = await callRedeem(
    { action: "check", code: voucher.redemption_code.toLowerCase() },
    token,
  );
  assert.equal(check.status, 200);
  const checked = (await check.json()).voucher;
  assert.equal(checked.id, voucher.id);
  assert.equal(checked.state, "valid");

  const redeem = await callRedeem(
    { action: "redeem", voucherId: voucher.id, qrToken: voucher.qr_token },
    token,
  );
  assert.equal(redeem.status, 200);
  assert.equal((await redeem.json()).voucher.state, "used");

  const { data: stored, error } = await admin
    .from("vouchers")
    .select("status, redeemed_by, redeemed_at")
    .eq("id", voucher.id)
    .single();
  assert.ifError(error);
  assert.equal(stored.status, "redeemed");
  assert.ok(stored.redeemed_by);
  assert.ok(stored.redeemed_at);

  // A second use by the same member returns the first result.
  const repeat = await callRedeem(
    { action: "redeem", voucherId: voucher.id, code: voucher.redemption_code },
    token,
  );
  assert.equal(repeat.status, 200);
  await repeat.body?.cancel();
});

Deno.test("staff of another organization cannot see or use the voucher", async () => {
  const voucher = await createVoucher();
  const token = await signIn(HARBOR_STAFF);

  const response = await callRedeem(
    { action: "redeem", voucherId: voucher.id, qrToken: voucher.qr_token },
    token,
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "VOUCHER_NOT_FOUND");

  const { data: stored, error } = await admin
    .from("vouchers")
    .select("status")
    .eq("id", voucher.id)
    .single();
  assert.ifError(error);
  assert.equal(stored.status, "active", "the voucher is untouched");
});

Deno.test("a request without a user JWT is rejected", async () => {
  const response = await callRedeem(
    { action: "check", code: "BLV-M4S7A1" },
    null,
  );
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

async function signIn(email: string): Promise<string> {
  const { data, error } = await createClient<Database>(
    SUPABASE_URL,
    PUBLISHABLE_KEY,
    clientOptions,
  ).auth.signInWithPassword({ email, password: PASSWORD });
  assert.ifError(error);
  return data.session.access_token;
}

/** An active Пирин СПА massage voucher with a random code. */
async function createVoucher() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6)
    .toUpperCase();
  const { data, error } = await admin
    .from("vouchers")
    .insert({
      redemption_code: `BLV-${suffix}`,
      service_id: ALPINE_MASSAGE_ID,
      expires_on: "2099-12-31",
    })
    .select("id, redemption_code, qr_token")
    .single();
  assert.ifError(error);
  return data;
}

function callRedeem(body: unknown, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
