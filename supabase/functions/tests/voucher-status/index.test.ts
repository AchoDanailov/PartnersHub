import assert from "node:assert/strict";
import app, { handleVoucherStatus } from "../../voucher-status/index.ts";
import type { VoucherStatusContext } from "../../voucher-status/types/context.ts";
import { voucherState } from "../../_shared/vouchers.ts";

const QR_TOKEN = "a7000000-0000-4000-8000-000000000001";
const VOUCHER = {
  id: "a5000000-0000-0000-0000-000000000001",
  service_id: "a4000000-0000-0000-0000-000000000001",
  status: "active",
  expires_on: "2099-12-31",
  redeemed_at: null,
  redeemed_by: null,
  services: {
    name: "Масаж",
    organization_id: "a1000000-0000-0000-0000-000000000001",
  },
};

Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
Deno.env.set(
  "SUPABASE_SECRET_KEYS",
  JSON.stringify({ default: "sb_secret_default_test_only" }),
);
Deno.env.set(
  "SUPABASE_PUBLISHABLE_KEYS",
  JSON.stringify({ default: "sb_publishable_default_test_only" }),
);

function createRequest(
  options: { method?: string; body?: string } = {},
): Request {
  const method = options.method ?? "POST";
  return new Request("http://localhost/functions/v1/voucher-status", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET"
      ? undefined
      : options.body ?? JSON.stringify({ qrToken: QR_TOKEN }),
  });
}

function createContext(
  options: { voucher?: unknown; error?: { code: string } } = {},
) {
  const lookups: { column: string; value: string }[] = [];
  const ctx = {
    supabaseAdmin: {
      from: () => ({
        select: () => ({
          eq: (column: string, value: string) => ({
            maybeSingle: () => {
              lookups.push({ column, value });
              return Promise.resolve(
                options.error ? { data: null, error: options.error } : {
                  data: options.voucher === undefined
                    ? VOUCHER
                    : options.voucher,
                  error: null,
                },
              );
            },
          }),
        }),
      }),
    },
  } as unknown as VoucherStatusContext;
  return { ctx, lookups };
}

Deno.test("rejects requests without the publishable key", async () => {
  const response = await app.fetch(createRequest());
  assert.equal(response.status, 401);
  assert.deepEqual(Object.keys(await response.json()).sort(), [
    "code",
    "message",
  ]);
});

Deno.test("returns 405 for non-POST requests", async () => {
  const { ctx, lookups } = createContext();
  const response = await handleVoucherStatus(
    createRequest({ method: "GET" }),
    ctx,
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(lookups.length, 0);
  await response.text();
});

Deno.test("returns 400 for invalid bodies without a lookup", async () => {
  for (
    const body of [
      "{",
      "null",
      "{}",
      '{"qrToken":1}',
      '{"qrToken":"not-a-uuid"}',
      JSON.stringify({ qrToken: QR_TOKEN, padding: "x".repeat(1024) }),
    ]
  ) {
    const { ctx, lookups } = createContext();
    const response = await handleVoucherStatus(createRequest({ body }), ctx);
    assert.equal(response.status, 400, body);
    assert.equal((await response.json()).code, "INVALID_REQUEST");
    assert.equal(lookups.length, 0);
  }
});

Deno.test("returns the voucher found by its lowercased QR token", async () => {
  const { ctx, lookups } = createContext();
  const response = await handleVoucherStatus(
    createRequest({
      body: JSON.stringify({ qrToken: QR_TOKEN.toUpperCase() }),
    }),
    ctx,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(lookups, [{ column: "qr_token", value: QR_TOKEN }]);
  assert.deepEqual(await response.json(), {
    voucher: {
      id: VOUCHER.id,
      serviceId: VOUCHER.service_id,
      serviceName: "Масаж",
      expiresOn: "2099-12-31",
      state: "valid",
      redeemedAt: null,
    },
  });
});

Deno.test("returns 404 for an unknown QR token", async () => {
  const { ctx } = createContext({ voucher: null });
  const response = await handleVoucherStatus(createRequest(), ctx);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "VOUCHER_NOT_FOUND");
});

Deno.test("returns 500 when the lookup fails", async () => {
  const { ctx } = createContext({ error: { code: "XX000" } });
  const response = await handleVoucherStatus(createRequest(), ctx);
  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, "VOUCHER_LOOKUP_FAILED");
});

Deno.test("derives the voucher state from status and expiry", () => {
  const today = "2026-11-16";
  assert.equal(
    voucherState({ status: "active", expires_on: today }, today),
    "valid",
  );
  assert.equal(
    voucherState({ status: "active", expires_on: "2026-11-15" }, today),
    "expired",
  );
  assert.equal(
    voucherState({ status: "redeemed", expires_on: "2026-11-15" }, today),
    "used",
  );
  assert.equal(
    voucherState({ status: "cancelled", expires_on: "2099-12-31" }, today),
    "cancelled",
  );
});
