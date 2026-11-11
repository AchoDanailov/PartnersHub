import assert from "node:assert/strict";
import { Image } from "imagescript";
import jsQR from "jsqr";
import { generateQrCode } from "../../generate-qrcode/helpers/qr-code.ts";

const decodeQr = jsQR as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

Deno.test("generates a 512px logo-bearing PNG that decodes to the destination", async () => {
  const destination =
    "https://partnershub.example/services/123?code=%7Bencrypted-code%7D";
  const png = await generateQrCode(destination);

  assert.deepEqual(
    [...png.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );

  const image = await Image.decode(png);
  assert.equal(image.width, 512);
  assert.equal(image.height, 512);

  const decoded = decodeQr(
    new Uint8ClampedArray(image.bitmap),
    image.width,
    image.height,
  );
  assert.equal(decoded?.data, destination);
});
