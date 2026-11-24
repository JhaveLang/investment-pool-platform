import { describe, expect, it } from "vitest";
import { groupNewsByYear, newsText } from "./news";

describe("newsText", () => {
  const entry = { textDe: "Support antwortet verzögert.", textEn: "Support may respond with a delay." };

  it("picks the visitor's language", () => {
    expect(newsText(entry, "de")).toBe(entry.textDe);
    expect(newsText(entry, "en")).toBe(entry.textEn);
  });
  it("shows the German text on the English website when there is no English one", () =>
    expect(newsText({ ...entry, textEn: null }, "en")).toBe(entry.textDe));
});

describe("groupNewsByYear", () => {
  it("groups newest-first notices by year and keeps their order", () => {
    const items = [
      { id: "a", date: "2026-11-03" },
      { id: "b", date: "2026-01-02" },
      { id: "c", date: "2025-12-30" },
    ];
    expect(groupNewsByYear(items)).toEqual([
      ["2026", [items[0], items[1]]],
      ["2025", [items[2]]],
    ]);
  });
  it("returns nothing for no notices", () => expect(groupNewsByYear([])).toEqual([]));
});
