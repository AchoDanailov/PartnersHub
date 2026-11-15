import assert from "node:assert/strict";
import {
  buildRedemptionUrl,
  readWebAppUrl,
} from "../../issue-voucher/helpers/url.ts";

const SERVICE_ID = "a4000000-0000-0000-0000-000000000001";
const QR_TOKEN = "c7000000-0000-4000-8000-000000000001";

function withWebAppUrl<T>(value: string | undefined, run: () => T): T {
  const previous = Deno.env.get("WEB_APP_URL");
  if (value === undefined) Deno.env.delete("WEB_APP_URL");
  else Deno.env.set("WEB_APP_URL", value);
  try {
    return run();
  } finally {
    if (previous === undefined) Deno.env.delete("WEB_APP_URL");
    else Deno.env.set("WEB_APP_URL", previous);
  }
}

Deno.test("builds the service page URL with the QR token", () => {
  for (
    const base of ["https://app.example.com", "https://app.example.com/"]
  ) {
    assert.equal(
      buildRedemptionUrl(new URL(base), SERVICE_ID, QR_TOKEN),
      `https://app.example.com/services/${SERVICE_ID}?t=${QR_TOKEN}`,
    );
  }
});

Deno.test("keeps a path prefix of the web app URL", () => {
  assert.equal(
    buildRedemptionUrl(
      new URL("https://example.com/hub"),
      SERVICE_ID,
      QR_TOKEN,
    ),
    `https://example.com/hub/services/${SERVICE_ID}?t=${QR_TOKEN}`,
  );
});

Deno.test("reads a valid web app URL from the environment", () => {
  const url = withWebAppUrl("http://localhost:5173", readWebAppUrl);
  assert.equal(url.href, "http://localhost:5173/");
});

Deno.test("rejects a missing or unusable web app URL", () => {
  for (
    const value of [
      undefined,
      "",
      "not a url",
      "ftp://app.example.com",
      "https://user:secret@app.example.com",
      "https://app.example.com/?a=1",
      "https://app.example.com/#top",
    ]
  ) {
    assert.throws(() => withWebAppUrl(value, readWebAppUrl), Error);
  }
});
