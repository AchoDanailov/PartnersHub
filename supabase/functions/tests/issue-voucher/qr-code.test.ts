import assert from "node:assert/strict";
import { generateQrCode } from "../../issue-voucher/helpers/qr-code.ts";
import { decodeQr } from "./decode-qr.ts";

Deno.test("generates a square PNG of about 512px that decodes to the destination", async () => {
  const destination =
    "https://partnershub.example/services/a4000000-0000-0000-0000-000000000001?t=c7000000-0000-4000-8000-000000000001";
  const png = await generateQrCode(destination);

  assert.deepEqual(
    [...png.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );

  const decoded = decodeQr(png);
  // qrcode floors width / modules * modules, so float rounding can give 511.
  assert.ok(decoded.width === 511 || decoded.width === 512, `${decoded.width}`);
  assert.equal(decoded.height, decoded.width);
  assert.equal(decoded.text, destination);
});
