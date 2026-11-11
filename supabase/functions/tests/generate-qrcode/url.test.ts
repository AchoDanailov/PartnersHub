import assert from "node:assert/strict";
import { RequestValidationError } from "../../_shared/http.ts";
import {
  buildDestinationUrl,
  readDestinationUrl,
} from "../../generate-qrcode/helpers/url.ts";

Deno.test("builds a service URL with an encoded optional code", () => {
  const result = buildDestinationUrl({
    url: "https://partnershub.example/services/123",
    queryParams: { code: "{encrypted-code}" },
  });

  assert.equal(
    result,
    "https://partnershub.example/services/123?code=%7Bencrypted-code%7D",
  );
  assert.ok(!result.includes("message"));
});

Deno.test("preserves existing parameters and replaces duplicate keys", () => {
  const result = new URL(buildDestinationUrl({
    url: "https://partnershub.example/services/123?keep=yes&code=old",
    queryParams: { code: "new code" },
  }));

  assert.equal(result.searchParams.get("keep"), "yes");
  assert.equal(result.searchParams.get("code"), "new code");
  assert.equal(
    [...result.searchParams.keys()].filter((key) => key === "code").length,
    1,
  );
});

Deno.test("omits the code when queryParams is absent", () => {
  const result = new URL(buildDestinationUrl({
    url: "https://partnershub.example/services/123",
  }));

  assert.equal(result.searchParams.has("code"), false);
});

Deno.test("round-trips Unicode query values", () => {
  const result = new URL(buildDestinationUrl({
    url: "https://partnershub.example/services/123",
    queryParams: { code: "код☃" },
  }));

  assert.equal(result.searchParams.get("code"), "код☃");
});

Deno.test("rejects invalid destinations and query parameters", () => {
  const invalidPayloads = [
    null,
    {},
    { url: "not-a-url" },
    { url: "ftp://partnershub.example/service" },
    { url: "https://user:secret@partnershub.example/service" },
    { url: "https://partnershub.example/service", queryParams: [] },
    { url: "https://partnershub.example/service", queryParams: { code: 123 } },
    { url: "https://partnershub.example/service", queryParams: { code: "" } },
  ];

  for (const payload of invalidPayloads) {
    assert.throws(() => buildDestinationUrl(payload), RequestValidationError);
  }
});

Deno.test("rejects a destination too large for a reliable QR code", () => {
  assert.throws(
    () =>
      buildDestinationUrl({
        url: "https://partnershub.example/services/123",
        queryParams: { code: "x".repeat(1024) },
      }),
    RequestValidationError,
  );
});

Deno.test("requires a JSON content type and valid JSON", async () => {
  const wrongContentType = new Request("http://localhost", {
    method: "POST",
    body: "{}",
  });
  await assert.rejects(
    () => readDestinationUrl(wrongContentType),
    RequestValidationError,
  );

  const malformed = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  await assert.rejects(
    () => readDestinationUrl(malformed),
    RequestValidationError,
  );
});

Deno.test("rejects oversized request bodies", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: `{"url":"${"x".repeat(17 * 1024)}"}`,
  });

  await assert.rejects(
    () => readDestinationUrl(request),
    RequestValidationError,
  );
});
