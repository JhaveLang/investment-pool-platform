import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/calendar";
import { newsEntries, sortedNews } from "./news";

describe("news entries", () => {
  it("have a valid date and text in both languages", () => {
    for (const entry of newsEntries) {
      // A real calendar day survives the round trip unchanged ("2026-02-30" would come back as March).
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(addDays(entry.date, 0)).toBe(entry.date);
      expect(entry.text.de.trim()).not.toBe("");
      expect(entry.text.en.trim()).not.toBe("");
    }
  });

  it("are listed newest first, whatever order they are written in", () => {
    const shuffled = [newsEntries[2], newsEntries[0], newsEntries[1]];
    expect(sortedNews(shuffled).map((entry) => entry.date)).toEqual(
      [newsEntries[0], newsEntries[1], newsEntries[2]]
        .map((entry) => entry.date)
        .sort()
        .reverse(),
    );
  });
});
