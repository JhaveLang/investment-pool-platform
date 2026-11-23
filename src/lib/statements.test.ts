import { describe, expect, it } from "vitest";
import {
  buildMonthStatement,
  buildStatements,
  firstStatementMonth,
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

describe("buildMonthStatement", () => {
  it("reproduces the sheet: investment on the 1st, return and movements", () => {
    const september = buildMonthStatement(entries, movements, "2026-09");
    expect(september.openingCents).toBe(831_585);
    expect(september.returnCents).toBe(41_579);
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
