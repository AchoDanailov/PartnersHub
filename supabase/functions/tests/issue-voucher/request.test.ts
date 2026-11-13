import assert from "node:assert/strict";
import { RequestValidationError } from "../../_shared/http.ts";
import { readVoucherRequest } from "../../issue-voucher/helpers/request.ts";

const VALID = {
  organizationId: "A1000000-0000-0000-0000-000000000001",
  serviceId: "A4000000-0000-0000-0000-000000000001",
  expiresOn: "2099-12-31",
  shopifyOrderId: "5123456789012",
  shopifyLineItemId: 13123456789012,
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
    shopifyOrderId: "5123456789012",
    shopifyLineItemId: "13123456789012",
    unit: 1,
  });

  const third = await readVoucherRequest(createRequest({ ...VALID, unit: 3 }));
  assert.equal(third.unit, 3);
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
    ["Shopify GID", { ...VALID, shopifyOrderId: "gid://shopify/Order/1" }],
    ["empty Shopify ID", { ...VALID, shopifyLineItemId: "" }],
    ["negative Shopify ID", { ...VALID, shopifyLineItemId: -5 }],
    ["fractional Shopify ID", { ...VALID, shopifyOrderId: 1.5 }],
    ["over-long Shopify ID", { ...VALID, shopifyOrderId: "1".repeat(21) }],
    ["unit zero", { ...VALID, unit: 0 }],
    ["fractional unit", { ...VALID, unit: 1.5 }],
    ["unit as a string", { ...VALID, unit: "2" }],
    ["unit above the limit", { ...VALID, unit: 101 }],
  ];

  for (const [name, body] of invalid) {
    await assert.rejects(
      readVoucherRequest(createRequest(body)),
      RequestValidationError,
      name,
    );
  }
});

Deno.test("rejects a body over the size limit", async () => {
  await assert.rejects(
    readVoucherRequest(createRequest({ ...VALID, padding: "x".repeat(1024) })),
    RequestValidationError,
  );
});
