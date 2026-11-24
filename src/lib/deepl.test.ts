import { describe, expect, it, vi } from "vitest";
import { deeplTranslateUrl, translateGermanToEnglish } from "./deepl";

const FREE_KEY = "11111111-2222-3333-4444-555555555555:fx";
const PRO_KEY = "11111111-2222-3333-4444-555555555555";

/** A fetch stand-in answering with the given status and JSON body. */
function answering(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

describe("deeplTranslateUrl", () => {
  it("uses the free host for :fx keys and the paid host otherwise", () => {
    expect(deeplTranslateUrl(FREE_KEY)).toBe("https://api-free.deepl.com/v2/translate");
    expect(deeplTranslateUrl(PRO_KEY)).toBe("https://api.deepl.com/v2/translate");
  });
});

describe("translateGermanToEnglish", () => {
  it("sends the key in the header and the text from German to British English", async () => {
    const fetchImpl = answering(200, {
      translations: [{ detected_source_language: "DE", text: " Support is busy. " }],
    });
    const result = await translateGermanToEnglish("Der Support ist ausgelastet.", FREE_KEY, fetchImpl);

    expect(result).toEqual({ ok: true, text: "Support is busy." });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api-free.deepl.com/v2/translate");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: `DeepL-Auth-Key ${FREE_KEY}` });
    expect(JSON.parse(String(init?.body))).toEqual({
      text: ["Der Support ist ausgelastet."],
      source_lang: "DE",
      target_lang: "EN-GB",
    });
  });

  it("reports a refused key or exhausted quota by status code, without the key", async () => {
    for (const status of [403, 456, 500]) {
      const result = await translateGermanToEnglish("Text", FREE_KEY, answering(status, { message: "nope" }));
      expect(result).toEqual({ ok: false, reason: `HTTP ${status}` });
      expect(JSON.stringify(result)).not.toContain(FREE_KEY);
    }
  });

  it("rejects an empty or missing translation", async () => {
    for (const body of [{ translations: [{ text: "  " }] }, { translations: [] }, {}, null]) {
      expect(await translateGermanToEnglish("Text", FREE_KEY, answering(200, body))).toEqual({
        ok: false,
        reason: "empty translation",
      });
    }
  });

  it("rejects a translation longer than a notice may be", async () => {
    const result = await translateGermanToEnglish(
      "Text",
      FREE_KEY,
      answering(200, { translations: [{ text: "a".repeat(501) }] }),
    );
    expect(result).toEqual({ ok: false, reason: "translation too long" });
  });

  it("turns network errors and timeouts into a failure instead of throwing", async () => {
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await translateGermanToEnglish("Text", FREE_KEY, offline)).toEqual({ ok: false, reason: "network error" });

    const slow = vi.fn<typeof fetch>(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    expect(await translateGermanToEnglish("Text", FREE_KEY, slow)).toEqual({ ok: false, reason: "timeout" });
  });
});
