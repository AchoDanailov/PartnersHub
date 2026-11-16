// @ts-types="npm:@types/qrcode@1.5.6"
import QRCode from "qrcode";
import { QR_SIZE } from "../constants/qr-code.ts";

/** Renders `destination` as a square PNG QR code. */
export async function generateQrCode(destination: string): Promise<Uint8Array> {
  const png = await QRCode.toBuffer(destination, {
    errorCorrectionLevel: "M",
    width: QR_SIZE,
    margin: 4,
  });
  return new Uint8Array(png);
}
