import jsQR from "jsqr";
// @ts-types="npm:@types/pngjs@6.0.5"
import { PNG } from "pngjs";
import { Buffer } from "node:buffer";

const decode = jsQR as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

/** Reads the text a PNG QR code encodes, and the image size. */
export function decodeQr(
  png: Uint8Array,
): { text: string | undefined; width: number; height: number } {
  const image = PNG.sync.read(Buffer.from(png));
  const result = decode(
    new Uint8ClampedArray(image.data),
    image.width,
    image.height,
  );
  return { text: result?.data, width: image.width, height: image.height };
}
