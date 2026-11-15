// Integration tests: run against the local stack started by `npx supabase start`
// (migrations + supabase/seeding/seed.sql) with the function served by
// `npx supabase functions serve`. CI exports the env variables read below;
// VOUCHER_ISSUER_SECRET and WEB_APP_URL come from supabase/functions/.env.example.
//
// Each test issues a voucher for a seeded service under a fresh idempotency
// key and deletes what it created, so the file can be re-run locally.
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import type { Database } from "../../_shared/database.types.ts";
import { decodeQr } from "./decode-qr.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const FUNCTIONS_URL = requireEnv("SUPABASE_FUNCTIONS_URL");
const SECRET_KEY = requireEnv("SUPABASE_SECRET_KEY");
const ISSUER_SECRET = requireEnv("VOUCHER_ISSUER_SECRET");
const WEB_APP_URL = requireEnv("WEB_APP_URL");

const ENDPOINT = `${FUNCTIONS_URL}/issue-voucher`;
const QR_BUCKET = "generated-qrs";
const ALPINE_ORGANIZATION_ID = "a1000000-0000-0000-0000-000000000001";
const ALPINE_MASSAGE_ID = "a4000000-0000-0000-0000-000000000001";
const EXPIRES_ON = "2099-12-31";

const admin = createClient<Database>(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.test("a caller with the issuer secret creates a voucher and its QR code, once", async () => {
  const idempotencyKey = crypto.randomUUID();
  const body = {
    organizationId: ALPINE_ORGANIZATION_ID,
    serviceId: ALPINE_MASSAGE_ID,
    expiresOn: EXPIRES_ON,
    idempotencyKey,
  };

  try {
    const first = await issueVoucher(body, ISSUER_SECRET);
    const created = await first.json();
    assert.equal(first.status, 201);
    assert.equal(created.serviceId, ALPINE_MASSAGE_ID);
    assert.equal(created.expiresOn, EXPIRES_ON);
    assert.equal(created.qrPath, `${created.voucherId}.png`);

    const { data: voucher, error } = await admin
      .from("vouchers")
      .select("id, redemption_code, service_id, status, expires_on")
      .eq("idempotency_key", idempotencyKey)
      .single();
    assert.ifError(error);
    assert.equal(voucher.id, created.voucherId);
    assert.equal(voucher.service_id, ALPINE_MASSAGE_ID);
    assert.equal(voucher.status, "active");
    assert.equal(voucher.expires_on, EXPIRES_ON);
    assert.match(voucher.redemption_code, /^BLV-[A-Z0-9]{6}$/);

    // The stored QR code opens the service page with the voucher's code.
    const { data: file, error: downloadError } = await admin.storage
      .from(QR_BUCKET)
      .download(created.qrPath);
    assert.ifError(downloadError);
    assert.ok(file, "the QR code is stored");
    const qr = decodeQr(new Uint8Array(await file.arrayBuffer()));
    assert.equal(
      qr.text,
      `${
        WEB_APP_URL.replace(/\/$/, "")
      }/services/${ALPINE_MASSAGE_ID}?code=${voucher.redemption_code}`,
    );

    // Repeating the call returns the same voucher instead of a second one.
    const second = await issueVoucher(body, ISSUER_SECRET);
    const repeated = await second.json();
    assert.equal(second.status, 200);
    assert.equal(repeated.voucherId, created.voucherId);

    const { count, error: countError } = await admin
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", idempotencyKey);
    assert.ifError(countError);
    assert.equal(count, 1);
  } finally {
    await removeVouchersWithKey(idempotencyKey);
  }
});

Deno.test("a caller with a wrong issuer secret is rejected and nothing is created", async () => {
  const idempotencyKey = crypto.randomUUID();

  const response = await issueVoucher(
    {
      organizationId: ALPINE_ORGANIZATION_ID,
      serviceId: ALPINE_MASSAGE_ID,
      expiresOn: EXPIRES_ON,
      idempotencyKey,
    },
    "not-the-issuer-secret",
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.code, "UNAUTHORIZED");

  const { count, error } = await admin
    .from("vouchers")
    .select("id", { count: "exact", head: true })
    .eq("idempotency_key", idempotencyKey);
  assert.ifError(error);
  assert.equal(count, 0);
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

function issueVoucher(body: unknown, secret: string): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Voucher-Issuer-Secret": secret,
    },
    body: JSON.stringify(body),
  });
}

async function removeVouchersWithKey(idempotencyKey: string): Promise<void> {
  const { data: vouchers, error } = await admin
    .from("vouchers")
    .delete()
    .eq("idempotency_key", idempotencyKey)
    .select("id");
  assert.ifError(error);
  if (vouchers.length === 0) return;

  const { error: removeError } = await admin.storage
    .from(QR_BUCKET)
    .remove(vouchers.map((voucher) => `${voucher.id}.png`));
  assert.ifError(removeError);
}
