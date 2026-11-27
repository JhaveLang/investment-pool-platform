import { describe, expect, it } from "vitest";
import { addMonths, firstDayOfMonth, lastDayOfMonth, type IsoMonth } from "./calendar";
import {
  buildMonthStatement,
  buildMonthStatements,
  buildPeriodStatement,
  buildStatements,
  firstStatementMonth,
  statementVarianceCents,
  type MonthStatement,
  type StatementEntry,
  type StatementMovement,
} from "./statements";

// Shaped like the client's sheet: 01UJ03 had 8.315,85 on 1 Sept, earned 415,79 in September,
// withdrew 415 (6 Sept) and deposited 1.074 (26 Sept) → 9.390,64 on 1 Oct.
const entries: StatementEntry[] = [
  { valueDate: "2026-08-01", amountCents: 831_585, returnMonth: null },
  { valueDate: "2026-09-06", amountCents: -41_500, returnMonth: null },
  { valueDate: "2026-09-26", amountCents: 107_400, returnMonth: null },
  { valueDate: "2026-10-01", amountCents: 41_579, returnMonth: "2026-09" },
];
const movements: StatementMovement[] = [
  {
    kind: "withdrawal",
    status: "approved",
    reference: "AZ-TEST",
    valueDate: "2026-09-06",
    amountCents: -41_500,
    pending: false,
    booked: true,
  },
  {
    kind: "deposit",
    status: "reconciled",
    reference: "EZ-TEST",
    valueDate: "2026-09-26",
    amountCents: 107_400,
    pending: false,
    booked: true,
  },
  {
    kind: "withdrawal",
    status: "pending",
    reference: "AZ-TEST",
    valueDate: "2026-10-13",
    amountCents: -41_500,
    pending: true,
    booked: false,
  },
];

describe("buildPeriodStatement", () => {
  function figures(from: string, to = from) {
    return buildPeriodStatement(entries, movements, { value: from, from, to });
  }

  it("counts only that day's bookings and carries prior postings into the opening", () => {
    expect(figures("2026-09-26")).toEqual({
      openingCents: 790_085, closingCents: 897_485, returnCents: null, movements: [movements[1]],
    });
  });

  it("attributes a booked return once at month-end and carries it into the next day's opening", () => {
    expect(figures("2026-09-29").returnCents).toBeNull();
    expect(figures("2026-09-30")).toMatchObject({ openingCents: 897_485, returnCents: 41_579, closingCents: 939_064 });
    expect(figures("2026-10-01")).toMatchObject({ openingCents: 939_064, returnCents: null, closingCents: 939_064 });
  });

  it("agrees with the existing full monthly statement", () => {
    expect({ month: "2026-09", ...figures("2026-09-01", "2026-09-30") }).toEqual(
      buildMonthStatement(entries, movements, "2026-09"),
    );
  });

  it("includes the entire year's booked returns and lists pending requests without debiting the closing balance", () => {
    const result = buildPeriodStatement([
      ...entries, { valueDate: "2026-11-01", returnMonth: "2026-10", amountCents: -2_000 },
    ], movements, { value: "2026", from: "2026-01-01", to: "2026-11-27" });
    expect(result).toMatchObject({ openingCents: null, closingCents: 937_064, returnCents: 39_579 });
    expect(result.movements[0]).toEqual(movements[2]);
    expect(figures("2025-12-31")).toEqual({ openingCents: null, closingCents: null, returnCents: null, movements: [] });
  });
});

describe("buildMonthStatement", () => {
  it("reproduces the sheet: investment on the 1st, return and movements", () => {
    const september = buildMonthStatement(entries, movements, "2026-09");
    expect(september.openingCents).toBe(831_585);
    expect(september.returnCents).toBe(41_579);
    expect(september.closingCents).toBe(939_064);
    expect(september.movements.map((movement) => movement.valueDate)).toEqual(["2026-09-26", "2026-09-06"]);
    expect(buildMonthStatement(entries, movements, "2026-10").openingCents).toBe(939_064);
  });

  it("chains: next 1st = this 1st + return + booked movements", () => {
    const september = buildMonthStatement(entries, movements, "2026-09");
    const october = buildMonthStatement(entries, movements, "2026-10");
    const booked = september.movements.filter((movement) => movement.booked);
    expect(october.openingCents).toBe(
      (september.openingCents ?? 0) +
        (september.returnCents ?? 0) +
        booked.reduce((sum, movement) => sum + movement.amountCents, 0),
    );
  });

  it("shows no investment before the first booking and no return before it is booked", () => {
    const july = buildMonthStatement(entries, movements, "2026-07");
    expect(july.openingCents).toBeNull();
    expect(buildMonthStatement(entries, movements, "2026-10").returnCents).toBeNull();
  });

  it("lists a pending request in its month without counting it as booked", () => {
    const october = buildMonthStatement(entries, movements, "2026-10");
    expect(october.movements).toEqual([movements[2]]);
    expect(buildMonthStatement(entries, movements, "2026-11").openingCents).toBe(939_064 + 0);
  });
});

describe("statementVarianceCents", () => {
  it("reconciles booked movements, ignores unbooked requests, and flags an unexplained debit", () => {
    const [september, october] = buildMonthStatements(entries, movements, ["2026-09", "2026-10"]);
    expect(statementVarianceCents(september)).toBe(0);
    expect(statementVarianceCents(october)).toBe(0);
    const statement = buildMonthStatement(
      [...entries, { valueDate: "2026-09-30", amountCents: -1_500, returnMonth: null }], movements, "2026-09",
    );
    expect(statementVarianceCents(statement)).toBe(-1_500);
  });

  it("flags a booked deposit missing from the ledger even before the first ledger posting", () => {
    const statement = buildMonthStatement([], [movements[1]], "2026-09");
    expect(statement.closingCents).toBeNull();
    expect(statementVarianceCents(statement)).toBe(-107_400);
  });
});

describe("buildStatements", () => {
  it("lists months newest first", () => {
    expect(buildStatements(entries, movements, "2026-08", "2026-10").map((statement) => statement.month)).toEqual([
      "2026-10",
      "2026-09",
      "2026-08",
    ]);
  });

  it("finds the first month with activity", () => {
    expect(firstStatementMonth(entries, movements)).toBe("2026-08");
    expect(firstStatementMonth([], [])).toBeNull();
  });
});

/** The statement as first written, month by month over every entry: what the one-pass version must match. */
function referenceMonthStatement(
  entries: readonly StatementEntry[],
  movements: readonly StatementMovement[],
  month: IsoMonth,
): MonthStatement {
  const start = firstDayOfMonth(month);
  const end = lastDayOfMonth(month);
  const before = entries.filter((entry) =>
    entry.returnMonth === null ? entry.valueDate < start : entry.returnMonth < month,
  );
  const returns = entries.filter((entry) => entry.returnMonth === month);
  const total = (list: StatementEntry[]) => list.reduce((sum, entry) => sum + entry.amountCents, 0);
  const throughMonth = entries.filter((entry) => entry.returnMonth === null ? entry.valueDate <= end : entry.returnMonth <= month);
  return {
    month,
    openingCents: before.length > 0 ? total(before) : null,
    closingCents: throughMonth.length > 0 ? total(throughMonth) : null,
    returnCents: returns.length > 0 ? total(returns) : null,
    movements: movements
      .filter((movement) => movement.valueDate >= start && movement.valueDate <= end)
      .sort((left, right) => right.valueDate.localeCompare(left.valueDate)),
  };
}

function movement(reference: string, valueDate: string, amountCents: number): StatementMovement {
  return { kind: "deposit", status: "reconciled", reference, valueDate, amountCents, pending: false, booked: true };
}

/** Deterministic pseudo-random numbers (mulberry32), so a failure can be replayed. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe("buildMonthStatements", () => {
  const range = buildStatements(entries, movements, "2026-06", "2026-12").map((statement) => statement.month);

  it("matches the month-by-month statement, in the order the months are given", () => {
    for (const months of [range, range.toReversed(), ["2026-10", "2026-07", "2026-12", "2026-09"]]) {
      expect(buildMonthStatements(entries, movements, months)).toEqual(
        months.map((month) => referenceMonthStatement(entries, movements, month)),
      );
    }
  });

  it("keeps a 1st of zero apart from no booking at all", () => {
    const netted: StatementEntry[] = [
      { valueDate: "2026-08-03", amountCents: 50_000, returnMonth: null },
      { valueDate: "2026-08-03", amountCents: -50_000, returnMonth: null },
    ];
    const [july, september] = buildMonthStatements(netted, [], ["2026-07", "2026-09"]);
    expect(july.openingCents).toBeNull();
    expect(september.openingCents).toBe(0);
  });

  it("answers a month asked twice the same way both times", () => {
    const [first, second] = buildMonthStatements(entries, movements, ["2026-09", "2026-09"]);
    expect(second).toEqual(first);
    expect(second.movements).not.toBe(first.movements);
  });

  it("keeps movements of the same day in their given order", () => {
    const sameDay = [movement("EZ-A", "2026-09-10", 100), movement("EZ-B", "2026-09-10", 200)];
    const [september] = buildMonthStatements([], [...sameDay, movement("EZ-C", "2026-09-20", 300)], ["2026-09"]);
    expect(september.movements.map((item) => item.reference)).toEqual(["EZ-C", "EZ-A", "EZ-B"]);
  });

  it("matches the month-by-month statement on random histories", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const next = random(seed);
      const pick = (count: number) => Math.floor(next() * count);
      const dayIn = (month: IsoMonth) => `${month}-${String(1 + pick(28)).padStart(2, "0")}`;
      const monthOffset = () => addMonths("2025-01", pick(30));
      const randomEntries: StatementEntry[] = Array.from({ length: pick(40) }, () => {
        const amountCents = pick(2) === 0 ? pick(100_000) - 50_000 : 0;
        if (pick(3) === 0) {
          const returnMonth = monthOffset();
          return { valueDate: firstDayOfMonth(addMonths(returnMonth, 1)), amountCents, returnMonth };
        }
        return { valueDate: dayIn(monthOffset()), amountCents, returnMonth: null };
      });
      const randomMovements = Array.from({ length: pick(20) }, (_unused, index) =>
        movement(`EZ-${index}`, dayIn(monthOffset()), pick(100_000) - 50_000),
      );
      const months = Array.from({ length: 1 + pick(36) }, () => addMonths("2024-10", pick(36)));
      expect(buildMonthStatements(randomEntries, randomMovements, months)).toEqual(
        months.map((month) => referenceMonthStatement(randomEntries, randomMovements, month)),
      );
    }
  });
});
