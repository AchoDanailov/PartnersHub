import { timingSafeEqual } from "node:crypto";
import {
  ISSUER_SECRET_ENV,
  ISSUER_SECRET_HEADER,
  MIN_ISSUER_SECRET_LENGTH,
} from "../constants/caller.ts";

const encoder = new TextEncoder();

/**
 * True when the request carries the issuer secret configured for this
 * function. Refuses every caller when the secret is not configured.
 *
 * Both values are hashed and compared in constant time, so the response time
 * does not reveal how much of a guessed secret was right.
 */
export async function isTrustedCaller(request: Request): Promise<boolean> {
  const expected = Deno.env.get(ISSUER_SECRET_ENV);
  if (!expected || expected.length < MIN_ISSUER_SECRET_LENGTH) {
    console.error(`${ISSUER_SECRET_ENV} is missing or too short.`);
    return false;
  }

  const provided = request.headers.get(ISSUER_SECRET_HEADER);
  if (!provided) return false;

  const [expectedDigest, providedDigest] = await Promise.all([
    sha256(expected),
    sha256(provided),
  ]);
  return timingSafeEqual(expectedDigest, providedDigest);
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}
