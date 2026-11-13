import assert from "node:assert/strict";
import { generateRedemptionCode } from "../../issue-voucher/helpers/code.ts";

Deno.test("generates BLV- codes with six uppercase letters or digits", () => {
  for (let i = 0; i < 500; i++) {
    assert.match(generateRedemptionCode(), /^BLV-[A-Z0-9]{6}$/);
  }
});

Deno.test("uses the whole alphabet and does not repeat itself", () => {
  const codes = new Set<string>();
  const characters = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const code = generateRedemptionCode();
    codes.add(code);
    for (const character of code.slice(4)) characters.add(character);
  }

  assert.equal(characters.size, 36);
  // 2000 draws out of 36^6 codes: a repeat here would mean a broken generator.
  assert.ok(codes.size >= 1999);
});
