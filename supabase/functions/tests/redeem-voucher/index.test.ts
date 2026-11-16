import assert from "node:assert/strict";
import app, { handleRedeemVoucher } from "../../redeem-voucher/index.ts";
import {
  createFakeContext,
  type FakeOptions,
  type FakeVoucher,
} from "./fake-database.ts";

const USER_ID = "a2000000-0000-0000-0000-000000000002";
const OTHER_USER_ID = "a2000000-0000-0000-0000-000000000003";
const ORGANIZATION_ID = "a1000000-0000-0000-0000-000000000001";
const OTHER_ORGANIZATION_ID = "a1000000-0000-0000-0000-000000000002";
const MEMBERSHIP = { organization_id: ORGANIZATION_ID, left_at: null };

const VALID: FakeVoucher = {
  id: "a5000000-0000-0000-0000-000000000001",
  service_id: "a4000000-0000-0000-0000-000000000001",
  status: "active",
  expires_on: "2099-12-31",
  redeemed_at: null,
  redeemed_by: null,
  qr_token: "a7000000-0000-4000-8000-000000000001",
  redemption_code: "BLV-M4S7A1",
  services: { name: "Масаж", organization_id: ORGANIZATION_ID },
};
const EXPIRED: FakeVoucher = {
  ...VALID,
  id: "a5000000-0000-0000-0000-000000000005",
  expires_on: "2000-01-01",
  qr_token: "a7000000-0000-4000-8000-000000000005",
  redemption_code: "BLV-S4UN42",
};
const CANCELLED: FakeVoucher = {
  ...VALID,
  id: "a5000000-0000-0000-0000-000000000003",
  status: "cancelled",
  qr_token: "a7000000-0000-4000-8000-000000000003",
  redemption_code: "BLV-M4S7A3",
};
const USED: FakeVoucher = {
  ...VALID,
  id: "a5000000-0000-0000-0000-000000000002",
  status: "redeemed",
  redeemed_by: OTHER_USER_ID,
  redeemed_at: "2026-11-14T10:00:00.000Z",
  qr_token: "a7000000-0000-4000-8000-000000000002",
  redemption_code: "BLV-M4S7A2",
};
const OTHER_ORGANIZATION: FakeVoucher = {
  ...VALID,
  id: "a5000000-0000-0000-0000-000000000006",
  service_id: "a4000000-0000-0000-0000-000000000003",
  qr_token: "a7000000-0000-4000-8000-000000000006",
  redemption_code: "BLV-D4YP51",
  services: { name: "Дневна карта", organization_id: OTHER_ORGANIZATION_ID },
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

function createRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/functions/v1/redeem-voucher", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET"
      ? undefined
      : typeof body === "string"
      ? body
      : JSON.stringify(body),
  });
}

function setup(options: FakeOptions = {}) {
  return createFakeContext({
    membership: MEMBERSHIP,
    vouchers: [
      structuredClone(VALID),
      structuredClone(EXPIRED),
      structuredClone(CANCELLED),
      structuredClone(USED),
      structuredClone(OTHER_ORGANIZATION),
    ],
    ...options,
  });
}

function redeemByQr(voucher: FakeVoucher) {
  return { action: "redeem", voucherId: voucher.id, qrToken: voucher.qr_token };
}

Deno.test("rejects requests without a user token", async () => {
  const response = await app.fetch(
    createRequest({ action: "check", code: VALID.redemption_code }),
  );
  assert.equal(response.status, 401);
  assert.deepEqual(Object.keys(await response.json()).sort(), [
    "code",
    "message",
  ]);
});

Deno.test("returns 405 for non-POST requests", async () => {
  const { ctx, queries } = setup();
  const response = await handleRedeemVoucher(createRequest(null, "GET"), ctx);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(queries.length, 0);
  await response.text();
});

Deno.test("returns 401 when the context has no user", async () => {
  const { ctx, queries } = setup({ userId: null });
  const response = await handleRedeemVoucher(
    createRequest({ action: "check", code: VALID.redemption_code }),
    ctx,
  );
  assert.equal(response.status, 401);
  assert.equal(queries.length, 0);
  await response.text();
});

Deno.test("returns 400 for invalid bodies without touching data", async () => {
  const bodies = [
    "{",
    "null",
    {},
    { action: "use", code: VALID.redemption_code },
    { action: "check" },
    { action: "check", code: VALID.redemption_code, qrToken: VALID.qr_token },
    { action: "check", code: "M4S7A1" },
    { action: "check", code: "BLV-M4S7A" },
    { action: "check", qrToken: "not-a-uuid" },
    { action: "redeem", qrToken: VALID.qr_token },
    { action: "redeem", voucherId: "1", qrToken: VALID.qr_token },
    { action: "check", code: VALID.redemption_code, padding: "x".repeat(1024) },
  ];
  for (const body of bodies) {
    const { ctx, queries } = setup();
    const response = await handleRedeemVoucher(createRequest(body), ctx);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).code, "INVALID_REQUEST");
    assert.equal(queries.length, 0);
  }
});

Deno.test("returns 403 for a caller who is not a current member", async () => {
  for (
    const membership of [null, {
      ...MEMBERSHIP,
      left_at: "2026-11-01T00:00:00Z",
    }]
  ) {
    const { ctx, queries } = setup({ membership });
    const response = await handleRedeemVoucher(
      createRequest(redeemByQr(VALID)),
      ctx,
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "FORBIDDEN");
    assert.deepEqual(queries.map((query) => query.table), [
      "organization_members",
    ]);
  }
});

Deno.test("checks a typed code, normalized, without revealing it", async () => {
  const { ctx, queries } = setup();
  const response = await handleRedeemVoucher(
    createRequest({ action: "check", code: "  blv-m4s7a1 " }),
    ctx,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    voucher: {
      id: VALID.id,
      serviceId: VALID.service_id,
      serviceName: "Масаж",
      expiresOn: "2099-12-31",
      state: "valid",
      redeemedAt: null,
    },
  });
  const lookup = queries.find((query) => query.table === "vouchers");
  assert.deepEqual(lookup?.filters, { redemption_code: "BLV-M4S7A1" });
  assert.equal(queries.some((query) => query.kind === "update"), false);
});

Deno.test("records a failed attempt for a wrong code or another organization's code", async () => {
  for (const code of ["BLV-ZZZZZZ", OTHER_ORGANIZATION.redemption_code]) {
    const { ctx, queries } = setup();
    const response = await handleRedeemVoucher(
      createRequest({ action: "check", code }),
      ctx,
    );
    assert.equal(response.status, 404, code);
    assert.equal((await response.json()).code, "VOUCHER_NOT_FOUND");
    assert.deepEqual(
      queries.filter((query) => query.kind === "insert"),
      [{
        table: "voucher_code_attempts",
        kind: "insert",
        filters: {},
        values: { user_id: USER_ID },
      }],
    );
  }
});

Deno.test("returns 429 after too many failed codes, before any lookup", async () => {
  const { ctx, queries } = setup({ failedAttempts: 5 });
  const response = await handleRedeemVoucher(
    createRequest({ action: "check", code: VALID.redemption_code }),
    ctx,
  );
  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, "TOO_MANY_ATTEMPTS");
  assert.equal(queries.some((query) => query.table === "vouchers"), false);
});

Deno.test("allows a code lookup below the limit", async () => {
  const { ctx } = setup({ failedAttempts: 4 });
  const response = await handleRedeemVoucher(
    createRequest({ action: "check", code: VALID.redemption_code }),
    ctx,
  );
  assert.equal(response.status, 200);
  await response.text();
});

Deno.test("does not limit or record QR token lookups", async () => {
  const { ctx, queries } = setup({ failedAttempts: 50 });
  const response = await handleRedeemVoucher(
    createRequest(redeemByQr(OTHER_ORGANIZATION)),
    ctx,
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "VOUCHER_NOT_FOUND");
  assert.equal(
    queries.some((query) => query.table === "voucher_code_attempts"),
    false,
  );
});

Deno.test("uses a valid voucher found by QR token", async () => {
  const { ctx, queries, vouchers } = setup();
  const response = await handleRedeemVoucher(
    createRequest(redeemByQr(VALID)),
    ctx,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.voucher.state, "used");
  assert.ok(body.voucher.redeemedAt);

  const update = queries.find((query) => query.kind === "update");
  assert.equal(update?.values?.status, "redeemed");
  assert.equal(update?.values?.redeemed_by, USER_ID);
  assert.equal(update?.filters.id, VALID.id);
  assert.equal(update?.filters.status, "active");
  assert.ok(update?.filters["expires_on>="]);
  assert.equal(vouchers[0].redeemed_by, USER_ID);
});

Deno.test("uses a valid voucher found by code", async () => {
  const { ctx } = setup();
  const response = await handleRedeemVoucher(
    createRequest({
      action: "redeem",
      voucherId: VALID.id,
      code: VALID.redemption_code,
    }),
    ctx,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).voucher.state, "used");
});

Deno.test("returns 404 when the voucher id does not match the token", async () => {
  const { ctx, queries } = setup();
  const response = await handleRedeemVoucher(
    createRequest({
      action: "redeem",
      voucherId: EXPIRED.id,
      qrToken: VALID.qr_token,
    }),
    ctx,
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "VOUCHER_NOT_FOUND");
  assert.equal(queries.some((query) => query.kind === "update"), false);
});

Deno.test("returns 409 for vouchers that cannot be used", async () => {
  const cases: [FakeVoucher, string][] = [
    [EXPIRED, "VOUCHER_EXPIRED"],
    [CANCELLED, "VOUCHER_CANCELLED"],
    [USED, "VOUCHER_ALREADY_REDEEMED"],
  ];
  for (const [voucher, code] of cases) {
    const { ctx, vouchers } = setup();
    const response = await handleRedeemVoucher(
      createRequest(redeemByQr(voucher)),
      ctx,
    );
    assert.equal(response.status, 409, code);
    assert.equal((await response.json()).code, code);
    const stored = vouchers.find((row) => row.id === voucher.id);
    assert.equal(stored?.status, voucher.status, "the voucher is unchanged");
  }
});

Deno.test("returns the first result when the same member uses a voucher again", async () => {
  const { ctx } = setup({ userId: OTHER_USER_ID });
  const response = await handleRedeemVoucher(
    createRequest(redeemByQr(USED)),
    ctx,
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.voucher.state, "used");
  assert.equal(body.voucher.redeemedAt, USED.redeemed_at);
});

Deno.test("returns 409 when another member uses the voucher first", async () => {
  const { ctx } = setup({
    beforeUpdate: (vouchers) => {
      Object.assign(vouchers[0], {
        status: "redeemed",
        redeemed_by: OTHER_USER_ID,
        redeemed_at: "2026-11-16T09:00:00.000Z",
      });
    },
  });
  const response = await handleRedeemVoucher(
    createRequest(redeemByQr(VALID)),
    ctx,
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "VOUCHER_ALREADY_REDEEMED");
});

Deno.test("returns 403 when the database rejects the member as redeemer", async () => {
  const { ctx } = setup({ updateError: { code: "P0001" } });
  const response = await handleRedeemVoucher(
    createRequest(redeemByQr(VALID)),
    ctx,
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "FORBIDDEN");
});

Deno.test("returns 500 when a query fails", async () => {
  const cases: [FakeOptions, unknown][] = [
    [{ membershipError: { code: "XX000" } }, redeemByQr(VALID)],
    [{ attemptsError: { code: "XX000" } }, {
      action: "check",
      code: VALID.redemption_code,
    }],
    [{ lookupError: { code: "XX000" } }, redeemByQr(VALID)],
    [{ updateError: { code: "XX000" } }, redeemByQr(VALID)],
  ];
  for (const [options, body] of cases) {
    const { ctx } = setup(options);
    const response = await handleRedeemVoucher(createRequest(body), ctx);
    assert.equal(response.status, 500, JSON.stringify(options));
    assert.equal((await response.json()).code, "REDEMPTION_FAILED");
  }
});
