import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvCell } from "./csv";

describe("escapeCsvCell", () => {
  it("quotes values containing the active delimiter, quotes or line breaks", () => {
    expect(escapeCsvCell("Müller; Hans", ";")).toBe('"Müller; Hans"');
    expect(escapeCsvCell("Smith, John", ",")).toBe('"Smith, John"');
    expect(escapeCsvCell('Sagt "Hallo"', ";")).toBe('"Sagt ""Hallo"""');
  });

  it("does not quote decimal commas when the delimiter is a semicolon", () => {
    expect(escapeCsvCell("1250,50", ";")).toBe("1250,50");
  });

  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(escapeCsvCell("=HYPERLINK(1)", ";")).toBe("'=HYPERLINK(1)");
    expect(escapeCsvCell("@SUM(A1)", ";")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("-50,00", ";")).toBe("-50,00");
    expect(escapeCsvCell("-50.00", ",")).toBe("-50.00");
  });

  it("renders empty values as empty cells", () => {
    expect(escapeCsvCell(null, ";")).toBe("");
    expect(escapeCsvCell(undefined, ";")).toBe("");
  });
});

describe("buildCsv", () => {
  const columns = [
    { header: "Name", value: (row: { name: string; amount: string }) => row.name },
    { header: "Amount", value: (row: { name: string; amount: string }) => row.amount },
  ];

  it("writes a BOM, a header line and delimiter-separated rows", () => {
    expect(buildCsv(columns, [{ name: "Anna", amount: "10,50" }], ";")).toBe("﻿Name;Amount\r\nAnna;10,50\r\n");
    expect(buildCsv(columns, [{ name: "Anna", amount: "10.50" }], ",")).toBe("﻿Name,Amount\r\nAnna,10.50\r\n");
  });
});
