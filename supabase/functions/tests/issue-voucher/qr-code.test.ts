import assert from "node:assert/strict";
import { generateQrCode } from "../../issue-voucher/helpers/qr-code.ts";
import { decodeQr } from "./decode-qr.ts";

Deno.test("generates a 512px PNG that decodes to the destination", async () => {
  const destination =
    "https://partnershub.example/services/a4000000-0000-0000-0000-000000000001?code=BLV-7K2QX9";
  const png = await generateQrCode(destination);

  assert.deepEqual(
    [...png.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );

  const decoded = decodeQr(png);
  assert.equal(decoded.width, 512);
  assert.equal(decoded.height, 512);
  assert.equal(decoded.text, destination);
});
