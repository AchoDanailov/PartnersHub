import assert from "node:assert/strict";
import app, { handleIssueVoucher } from "../../issue-voucher/index.ts";
import type { IssueVoucherContext } from "../../issue-voucher/types.ts";
import { decodeQr } from "./decode-qr.ts";

const SECRET = "test-only-voucher-issuer-secret-0123456789";
const WEB_APP_URL = "http://localhost:5173";
const ORGANIZATION_ID = "a1000000-0000-0000-0000-000000000001";
const SERVICE_ID = "a4000000-0000-0000-0000-000000000001";
const VOUCHER_ID = "a5000000-0000-0000-0000-0000000000aa";
const EXPIRES_ON = "2099-12-31";

const BODY = {
  organizationId: ORGANIZATION_ID,
  serviceId: SERVICE_ID,
  expiresOn: EXPIRES_ON,
  shopifyOrderId: "5123456789012",
  shopifyLineItemId: "13123456789012",
  unit: 2,
};
const EXISTING = {
  id: VOUCHER_ID,
  redemption_code: "BLV-FIRST1",
  service_id: SERVICE_ID,
  expires_on: EXPIRES_ON,
};

Deno.env.set("VOUCHER_ISSUER_SECRET", SECRET);
Deno.env.set("WEB_APP_URL", WEB_APP_URL);
Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
Deno.env.set(
  "SUPABASE_SECRET_KEYS",
  JSON.stringify({ default: "sb_secret_default_test_only" }),
);
Deno.env.set(
  "SUPABASE_PUBLISHABLE_KEYS",
  JSON.stringify({ default: "sb_publishable_default_test_only" }),
);

type VoucherRow = Record<string, unknown> & { redemption_code: string };
type Result = { data: unknown; error: { code: string } | null };

function createRequest(
  options: { method?: string; body?: unknown; secret?: string | null } = {},
): Request {
  const method = options.method ?? "POST";
  const headers = new Headers({ "Content-Type": "application/json" });
  const secret = options.secret === undefined ? SECRET : options.secret;
  if (secret !== null) headers.set("X-Voucher-Issuer-Secret", secret);

  return new Request("http://localhost/functions/v1/issue-voucher", {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(options.body ?? BODY),
  });
}

/**
 * A fake admin client that records every call. `inserts` answers the insert
 * attempts in order; when it runs out, the insert succeeds.
 */
function createContext(options: {
  service?: Result;
  inserts?: Result[];
  existing?: Result;
  uploadError?: { name: string };
} = {}) {
  const calls = {
    serviceLookups: [] as { serviceId: string; organizationId: string }[],
    inserts: [] as { row: VoucherRow; options: unknown }[],
    existingLookups: [] as unknown[][],
    uploads: [] as {
      bucket: string;
      path: string;
      body: Uint8Array;
      options: unknown;
    }[],
  };
  const inserts = [...(options.inserts ?? [])];

  const supabaseAdmin = {
    from: (table: string) => {
      if (table === "services") {
        return {
          select: () => ({
            eq: (_id: string, serviceId: string) => ({
              eq: (_organization: string, organizationId: string) => ({
                maybeSingle: () => {
                  calls.serviceLookups.push({ serviceId, organizationId });
                  return Promise.resolve(
                    options.service ?? {
                      data: {
                        id: SERVICE_ID,
                        organizations: { deactivated_at: null },
                      },
                      error: null,
                    },
                  );
                },
              }),
            }),
          }),
        };
      }
      if (table === "vouchers") {
        return {
          upsert: (row: VoucherRow, upsertOptions: unknown) => ({
            select: () => {
              calls.inserts.push({ row, options: upsertOptions });
              return Promise.resolve(
                inserts.shift() ?? {
                  data: [{
                    id: VOUCHER_ID,
                    redemption_code: row.redemption_code,
                    service_id: row.service_id,
                    expires_on: row.expires_on,
                  }],
                  error: null,
                },
              );
            },
          }),
          select: () => ({
            eq: (_order: string, orderId: unknown) => ({
              eq: (_lineItem: string, lineItemId: unknown) => ({
                eq: (_unit: string, unit: unknown) => ({
                  maybeSingle: () => {
                    calls.existingLookups.push([orderId, lineItemId, unit]);
                    return Promise.resolve(
                      options.existing ?? { data: EXISTING, error: null },
                    );
                  },
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, body: Uint8Array, uploadOptions: unknown) => {
          calls.uploads.push({ bucket, path, body, options: uploadOptions });
          return Promise.resolve(
            options.uploadError
              ? { data: null, error: options.uploadError }
              : { data: { path }, error: null },
          );
        },
      }),
    },
  };

  return {
    ctx: { supabaseAdmin } as unknown as IssueVoucherContext,
    calls,
  };
}

function assertNothingWritten(
  calls: ReturnType<typeof createContext>["calls"],
) {
  assert.equal(calls.inserts.length, 0);
  assert.equal(calls.uploads.length, 0);
}

async function withEnv(
  name: string,
  value: string | undefined,
  run: () => Promise<void>,
): Promise<void> {
  const previous = Deno.env.get(name);
  if (value === undefined) Deno.env.delete(name);
  else Deno.env.set(name, value);
  try {
    await run();
  } finally {
    if (previous === undefined) Deno.env.delete(name);
    else Deno.env.set(name, previous);
  }
}

// Caller authentication

Deno.test("rejects a missing or wrong issuer secret before touching the database", async () => {
  for (const secret of [null, "", "wrong-secret", `${SECRET}x`]) {
    const { ctx, calls } = createContext();
    const response = await handleIssueVoucher(createRequest({ secret }), ctx);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      code: "UNAUTHORIZED",
      message: "A valid issuer secret is required.",
    });
    assert.equal(calls.serviceLookups.length, 0);
    assertNothingWritten(calls);
  }
});

Deno.test("refuses every caller when the issuer secret is not configured", async () => {
  for (const configured of [undefined, "", "too-short"]) {
    await withEnv("VOUCHER_ISSUER_SECRET", configured, async () => {
      const { ctx, calls } = createContext();
      const response = await handleIssueVoucher(
        createRequest({ secret: configured ?? "" }),
        ctx,
      );
      await response.body?.cancel();

      assert.equal(response.status, 401);
      assert.equal(calls.serviceLookups.length, 0);
    });
  }
});

Deno.test("the served function rejects a request without the secret", async () => {
  // Also what the CI boot probe sends: a user JWT and an empty body.
  const response = await app.fetch(
    new Request("http://localhost/functions/v1/issue-voucher", {
      method: "POST",
      headers: { Authorization: "Bearer not-the-issuer-secret" },
    }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(Object.keys(await response.json()).sort(), [
    "code",
    "message",
  ]);
});

// Request handling

Deno.test("returns 405 for an authenticated non-POST request", async () => {
  const { ctx, calls } = createContext();
  const response = await handleIssueVoucher(
    createRequest({ method: "GET" }),
    ctx,
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.deepEqual(await response.json(), {
    code: "METHOD_NOT_ALLOWED",
    message: "Use POST.",
  });
  assertNothingWritten(calls);
});

Deno.test("returns 400 for an invalid body", async () => {
  const { ctx, calls } = createContext();
  const response = await handleIssueVoucher(
    createRequest({ body: { ...BODY, serviceId: "not-a-uuid" } }),
    ctx,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    code: "INVALID_REQUEST",
    message: "serviceId must be a valid UUID.",
  });
  assert.equal(calls.serviceLookups.length, 0);
  assertNothingWritten(calls);
});

Deno.test("returns 500 without writing when the web app URL is not configured", async () => {
  await withEnv("WEB_APP_URL", undefined, async () => {
    const { ctx, calls } = createContext();
    const response = await handleIssueVoucher(createRequest(), ctx);

    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, "VOUCHER_ISSUE_FAILED");
    assert.equal(calls.serviceLookups.length, 0);
    assertNothingWritten(calls);
  });
});

// Organization and service checks

Deno.test("returns 404 when the service is not in the organization", async () => {
  const { ctx, calls } = createContext({
    service: { data: null, error: null },
  });
  const response = await handleIssueVoucher(createRequest(), ctx);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    code: "SERVICE_NOT_FOUND",
    message: "The service does not exist in that organization.",
  });
  assert.deepEqual(calls.serviceLookups, [
    { serviceId: SERVICE_ID, organizationId: ORGANIZATION_ID },
  ]);
  assertNothingWritten(calls);
});

Deno.test("returns 409 when the organization is deactivated", async () => {
  const { ctx, calls } = createContext({
    service: {
      data: {
        id: SERVICE_ID,
        organizations: { deactivated_at: "2026-11-01T00:00:00+00:00" },
      },
      error: null,
    },
  });
  const response = await handleIssueVoucher(createRequest(), ctx);

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "ORGANIZATION_DEACTIVATED");
  assertNothingWritten(calls);
});

Deno.test("returns 500 when the service lookup fails", async () => {
  const { ctx, calls } = createContext({
    service: { data: null, error: { code: "PGRST000" } },
  });
  const response = await handleIssueVoucher(createRequest(), ctx);

  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, "VOUCHER_ISSUE_FAILED");
  assertNothingWritten(calls);
});

// Issuing

Deno.test("creates a voucher and stores its QR code", async () => {
  const { ctx, calls } = createContext();
  const response = await handleIssueVoucher(createRequest(), ctx);

  assert.equal(response.status, 201);
  // The redemption code is not part of the response.
  assert.deepEqual(await response.json(), {
    voucherId: VOUCHER_ID,
    serviceId: SERVICE_ID,
    expiresOn: EXPIRES_ON,
    qrPath: `${VOUCHER_ID}.png`,
  });

  assert.equal(calls.inserts.length, 1);
  const { row, options } = calls.inserts[0];
  assert.match(row.redemption_code, /^BLV-[A-Z0-9]{6}$/);
  assert.deepEqual(row, {
    redemption_code: row.redemption_code,
    service_id: SERVICE_ID,
    expires_on: EXPIRES_ON,
    shopify_order_id: "5123456789012",
    shopify_line_item_id: "13123456789012",
    shopify_line_item_unit: 2,
  });
  assert.deepEqual(options, {
    onConflict: "shopify_order_id,shopify_line_item_id,shopify_line_item_unit",
    ignoreDuplicates: true,
  });
  assert.equal(calls.existingLookups.length, 0);

  assert.equal(calls.uploads.length, 1);
  const upload = calls.uploads[0];
  assert.equal(upload.bucket, "generated-qrs");
  assert.equal(upload.path, `${VOUCHER_ID}.png`);
  assert.deepEqual(upload.options, { contentType: "image/png", upsert: true });
  assert.equal(
    decodeQr(upload.body).text,
    `${WEB_APP_URL}/services/${SERVICE_ID}?code=${row.redemption_code}`,
  );
});

Deno.test("a repeated call returns the first voucher and stores its QR code again", async () => {
  const { ctx, calls } = createContext({
    inserts: [{ data: [], error: null }],
  });
  const response = await handleIssueVoucher(createRequest(), ctx);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    voucherId: VOUCHER_ID,
    serviceId: SERVICE_ID,
    expiresOn: EXPIRES_ON,
    qrPath: `${VOUCHER_ID}.png`,
  });
  assert.equal(calls.inserts.length, 1);
  assert.deepEqual(calls.existingLookups, [
    ["5123456789012", "13123456789012", 2],
  ]);
  assert.equal(
    decodeQr(calls.uploads[0].body).text,
    `${WEB_APP_URL}/services/${SERVICE_ID}?code=BLV-FIRST1`,
  );
});

Deno.test("returns 409 when a repeated call asks for a different service or expiry", async () => {
  for (
    const existing of [
      { ...EXISTING, service_id: "a4000000-0000-0000-0000-000000000002" },
      { ...EXISTING, expires_on: "2098-01-01" },
    ]
  ) {
    const { ctx, calls } = createContext({
      inserts: [{ data: [], error: null }],
      existing: { data: existing, error: null },
    });
    const response = await handleIssueVoucher(createRequest(), ctx);

    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "IDEMPOTENCY_CONFLICT");
    assert.equal(calls.uploads.length, 0);
  }
});

Deno.test("returns 500 when the first voucher of a repeated call cannot be read", async () => {
  for (
    const existing of [
      { data: null, error: null },
      { data: null, error: { code: "PGRST000" } },
    ]
  ) {
    const { ctx, calls } = createContext({
      inserts: [{ data: [], error: null }],
      existing,
    });
    const response = await handleIssueVoucher(createRequest(), ctx);

    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, "VOUCHER_ISSUE_FAILED");
    assert.equal(calls.uploads.length, 0);
  }
});

Deno.test("picks another code when the generated one is taken", async () => {
  const { ctx, calls } = createContext({
    inserts: [{ data: null, error: { code: "23505" } }],
  });
  const response = await handleIssueVoucher(createRequest(), ctx);
  await response.body?.cancel();

  assert.equal(response.status, 201);
  assert.equal(calls.inserts.length, 2);
  assert.equal(calls.uploads.length, 1);
});

Deno.test("gives up after three taken codes", async () => {
  const taken = { data: null, error: { code: "23505" } };
  const { ctx, calls } = createContext({ inserts: [taken, taken, taken] });
  const response = await handleIssueVoucher(createRequest(), ctx);

  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, "VOUCHER_ISSUE_FAILED");
  assert.equal(calls.inserts.length, 3);
  assert.equal(calls.uploads.length, 0);
});

Deno.test("returns 409 when the organization is deactivated during the insert", async () => {
  const { ctx, calls } = createContext({
    inserts: [{ data: null, error: { code: "P0001" } }],
  });
  const response = await handleIssueVoucher(createRequest(), ctx);

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "ORGANIZATION_DEACTIVATED");
  assert.equal(calls.uploads.length, 0);
});

Deno.test("returns 500 when the insert fails", async () => {
  const { ctx, calls } = createContext({
    inserts: [{ data: null, error: { code: "23503" } }],
  });
  const response = await handleIssueVoucher(createRequest(), ctx);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    code: "VOUCHER_ISSUE_FAILED",
    message: "The voucher could not be issued.",
  });
  assert.equal(calls.inserts.length, 1);
  assert.equal(calls.uploads.length, 0);
});

// QR code

Deno.test("returns 500 when the QR code cannot be generated", async () => {
  // Too long for any QR code, so generation fails after the voucher is saved.
  const tooLong = `https://app.example.com/${"a".repeat(4000)}`;
  await withEnv("WEB_APP_URL", tooLong, async () => {
    const { ctx, calls } = createContext();
    const response = await handleIssueVoucher(createRequest(), ctx);

    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, "QR_GENERATION_FAILED");
    assert.equal(calls.inserts.length, 1);
    assert.equal(calls.uploads.length, 0);
  });
});

Deno.test("returns 502 when the QR code cannot be stored", async () => {
  const { ctx } = createContext({ uploadError: { name: "StorageApiError" } });
  const response = await handleIssueVoucher(createRequest(), ctx);

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    code: "QR_UPLOAD_FAILED",
    message:
      "The voucher was saved, but its QR code was not stored. Try again.",
  });
});
