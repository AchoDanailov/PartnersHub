import assert from "node:assert/strict";
import { Image } from "imagescript";
import jsQR from "jsqr";
import { parseLocalSecretKeys } from "../../generate-qrcode/helpers/secret-keys.ts";
import app, { handleGenerateQrCode } from "../../generate-qrcode/index.ts";

const decodeQr = jsQR as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

const validKey = "sb_secret_qr_generator_test_only";
const validBody = JSON.stringify({
  url: "https://partnershub.example/services/123",
  queryParams: { code: "{encrypted-code}" },
});

Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
Deno.env.set(
  "SUPABASE_SECRET_KEYS",
  JSON.stringify({
    default: "sb_secret_default_test_only",
    "qr-generator": validKey,
    other: "sb_secret_other_test_only",
  }),
);
Deno.env.set(
  "SUPABASE_PUBLISHABLE_KEYS",
  JSON.stringify({ default: "sb_publishable_default_test_only" }),
);

function createRequest(options: {
  apikey?: string;
  method?: string;
  body?: string;
} = {}): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.apikey) headers.set("apikey", options.apikey);

  return new Request("http://localhost/functions/v1/generate-qrcode", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "GET" ? undefined : options.body ?? validBody,
  });
}

Deno.test("parses and validates local named secret overrides", () => {
  assert.equal(parseLocalSecretKeys(undefined), undefined);
  assert.deepEqual(
    parseLocalSecretKeys('{"qr-generator":"sb_secret_local_test_only"}'),
    { "qr-generator": "sb_secret_local_test_only" },
  );

  for (const raw of ["{", "[]", '{"qr-generator":""}', '{"qr-generator":1}']) {
    assert.throws(() => parseLocalSecretKeys(raw), Error);
  }
});

Deno.test("rejects missing, invalid, and differently named secrets", async () => {
  for (
    const apikey of [
      undefined,
      "sb_secret_wrong_test_only",
      "sb_secret_other_test_only",
    ]
  ) {
    const response = await app.fetch(createRequest({ apikey }));
    assert.equal(response.status, 401);
    // Auth errors use the same flat shape, without hint, docs, or details.
    const payload = await response.json();
    assert.deepEqual(Object.keys(payload).sort(), ["code", "message"]);
  }
});

Deno.test("returns a decodable PNG for a valid request", async () => {
  const response = await handleGenerateQrCode(createRequest());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "no-store");

  const png = new Uint8Array(await response.arrayBuffer());
  const image = await Image.decode(png);
  const decoded = decodeQr(
    new Uint8ClampedArray(image.bitmap),
    image.width,
    image.height,
  );
  assert.equal(
    decoded?.data,
    "https://partnershub.example/services/123?code=%7Bencrypted-code%7D",
  );
});

Deno.test("returns 405 for non-POST requests", async () => {
  const response = await handleGenerateQrCode(createRequest({ method: "GET" }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.deepEqual(await response.json(), {
    code: "METHOD_NOT_ALLOWED",
    message: "Use POST.",
  });
});

Deno.test("passes a valid named secret through to the handler", async () => {
  const response = await app.fetch(createRequest({ apikey: validKey }));
  assert.equal(response.status, 200);
  await response.body?.cancel();
});

Deno.test("returns 400 for malformed JSON", async () => {
  const response = await handleGenerateQrCode(createRequest({ body: "{" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    code: "INVALID_REQUEST",
    message: "The request body must be valid JSON.",
  });
});
