import assert from "node:assert/strict";
import { handleGenerateQrCode } from "../../generate-qrcode/index.ts";

// Its own file, so this module instance starts with an empty logo cache and
// the stubbed read below is what generateQrCode sees.
Deno.test("returns 500 when the QR code cannot be generated", async () => {
  const readFile = Deno.readFile;
  Deno.readFile = () => Promise.reject(new Error("unreadable logo"));
  try {
    const response = await handleGenerateQrCode(
      new Request("http://localhost/functions/v1/generate-qrcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://partnershub.example/services/1" }),
      }),
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      code: "QR_GENERATION_FAILED",
      message: "The QR code could not be generated.",
    });
  } finally {
    Deno.readFile = readFile;
  }
});
