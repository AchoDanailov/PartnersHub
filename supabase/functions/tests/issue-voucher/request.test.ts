import assert from "node:assert/strict";
import { RequestValidationError } from "../../_shared/http.ts";
import { readVoucherRequest } from "../../issue-voucher/helpers/request.ts";

const VALID = {
  organizationId: "A1000000-0000-0000-0000-000000000001",
  serviceId: "A4000000-0000-0000-0000-000000000001",
  expiresOn: "2099-12-31",
  idempotencyKey: "B6000000-0000-4000-8000-000000000001",
};

function createRequest(body: unknown): Request {
  return new Request("http://localhost/functions/v1/issue-voucher", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

Deno.test("normalises a valid request", async () => {
  assert.deepEqual(await readVoucherRequest(createRequest(VALID)), {
    organizationId: "a1000000-0000-0000-0000-000000000001",
    serviceId: "a4000000-0000-0000-0000-000000000001",
    expiresOn: "2099-12-31",
    idempotencyKey: "b6000000-0000-4000-8000-000000000001",
  });
});

Deno.test("accepts an expiry of today", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const request = await readVoucherRequest(
    createRequest({ ...VALID, expiresOn: today }),
  );
  assert.equal(request.expiresOn, today);
});

Deno.test("rejects invalid fields", async () => {
  const invalid: [string, unknown][] = [
    ["not an object", [VALID]],
    ["missing organizationId", { ...VALID, organizationId: undefined }],
    ["malformed serviceId", { ...VALID, serviceId: "a4000000" }],
    ["expiry with a time", { ...VALID, expiresOn: "2099-12-31T00:00:00Z" }],
    ["impossible date", { ...VALID, expiresOn: "2099-02-30" }],
    ["past date", { ...VALID, expiresOn: "2020-01-01" }],
    ["non-string date", { ...VALID, expiresOn: 20991231 }],
    ["missing idempotencyKey", { ...VALID, idempotencyKey: undefined }],
    ["malformed idempotencyKey", { ...VALID, idempotencyKey: "b6000000" }],
    ["numeric idempotencyKey", { ...VALID, idempotencyKey: 12345 }],
  ];

  for (const [name, body] of invalid) {
    await assert.rejects(
      readVoucherRequest(createRequest(body)),
      RequestValidationError,
      name,
    );
  }
});

Deno.test("reports every invalid field in one message", async () => {
  await assert.rejects(
    readVoucherRequest(
      createRequest({ ...VALID, serviceId: "a4000000", expiresOn: undefined }),
    ),
    {
      name: "RequestValidationError",
      message:
        "serviceId must be a valid UUID. expiresOn must be a real YYYY-MM-DD date.",
    },
  );
});

Deno.test("rejects a body over the size limit", async () => {
  await assert.rejects(
    readVoucherRequest(createRequest({ ...VALID, padding: "x".repeat(1024) })),
    RequestValidationError,
  );
});
