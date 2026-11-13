import { CODE_ALPHABET, CODE_LENGTH, CODE_PREFIX } from "../constants/code.ts";

/** A new random redemption code, for example `BLV-7K2QX9`. */
export function generateRedemptionCode(): string {
  // Bytes at or above this limit are skipped, so every character is equally likely.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  const bytes = new Uint8Array(CODE_LENGTH * 2);
  let code = "";

  while (code.length < CODE_LENGTH) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === CODE_LENGTH) break;
    }
  }

  return CODE_PREFIX + code;
}
