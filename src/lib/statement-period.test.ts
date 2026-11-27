import { describe, expect, it } from "vitest";
import { directoryStatementMonths, parseStatementPeriod } from "./statement-period";

const today = "2026-11-27";

describe("investor directory statement month", () => {
  it.each([
    [today, "2026-11", "2026-11-01"],
    ["2027-01-01", "2027-01", "2027-01-01"],
    ["2024-02-29", "2024-02", "2024-02-01"],
  ])("shows the current month through %s", (date, value, from) => {
    expect(directoryStatementMonths(date).period).toEqual({ value, from, to: date });
  });

  it("offers January through December of the current year in order", () => {
    const { months } = directoryStatementMonths("2027-01-01");
    expect(months).toEqual(Array.from({ length: 12 }, (_item, index) => `2027-${String(index + 1).padStart(2, "0")}`));
  });

  it.each([
    ["2024-02", "2024-02-01", "2024-02-29"],
    ["2024-12", "2024-12-01", "2024-12-31"],
    ["2024-06", "2024-06-01", "2024-06-04"],
  ])("accepts the selected month %s", (value, from, to) => {
    expect(directoryStatementMonths("2024-06-04", value).period).toEqual({ value, from, to });
  });

  it.each(["2025-10", "2027-01", "2026-13", "11", "2026-11-15"])("uses the current month for %s", (input) => {
    expect(directoryStatementMonths(today, input).period.value).toBe("2026-11");
  });
});

describe("export statement period", () => {
  it.each([
    ["2025", "2025-01-01", "2025-12-31"],
    ["2026", "2026-01-01", today],
    ["2024-02", "2024-02-01", "2024-02-29"],
    ["2024-02-29", "2024-02-29", "2024-02-29"],
    ["2026-11", "2026-11-01", today],
    [today, today, today],
  ])("reads %s", (value, from, to) => expect(parseStatementPeriod(value, today)).toEqual({ value, from, to }));

  it.each(["2025-02-29", "2026-11-28", "2027", "2026-13", "2026-00", "2026-09-00", ""])(
    "rejects %s", (value) => expect(parseStatementPeriod(value, today)).toBeNull(),
  );
});
