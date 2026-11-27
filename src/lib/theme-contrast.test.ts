import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The colour tokens as declared in the theme, e.g. `--color-canvas: #fff7fb;` → { canvas: "#fff7fb" }.
const css = readFileSync("src/app/globals.css", "utf8");
const tokens = new Map([...css.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6});/gi)].map(([, name, hex]) => [name, hex.toLowerCase()]));

function token(name: string): string {
  const hex = tokens.get(name);
  if (!hex) throw new Error(`No colour token --color-${name}`);
  return hex;
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (light + 0.05) / (dark + 0.05);
}

/** Backgrounds that carry text; `highest` is only the secondary button's hover. */
const TEXT_SURFACES = ["canvas", "surface", "raised", "well", "overlay"];

describe("theme", () => {
  it("uses the new palette", () => {
    expect(token("canvas")).toBe("#fff7fb");
    expect(token("accent-400")).toBe("#563364");
    expect(token("accent-300")).toBe("#350c44");
    expect(token("footer")).toBe("#332f33");
  });
  it.each(["fg", "muted", "subtle", "accent-400", "accent-300", "gain", "loss", "warn"])(
    "%s meets 4.5:1 on every text surface",
    (text) => TEXT_SURFACES.forEach((surface) => expect(contrast(token(text), token(surface))).toBeGreaterThanOrEqual(4.5)),
  );
  it.each(["fg", "muted", "accent-400"])("%s meets 4.5:1 on highest (secondary button hover)", (text) =>
    expect(contrast(token(text), token("highest"))).toBeGreaterThanOrEqual(4.5),
  );
  it("white text meets 4.5:1 on accent-400, accent-300 and footer", () =>
    ["accent-400", "accent-300", "footer"].forEach((background) =>
      expect(contrast("#ffffff", token(background))).toBeGreaterThanOrEqual(4.5),
    ));
  it("keeps well and raised apart, so inputs stay visible on raised panels", () =>
    expect(token("well")).not.toBe(token("raised")));
});
