// The BOM lets Excel detect UTF-8, so umlauts display correctly.
const CSV_LINE_BREAK = "\r\n";
const UTF8_BOM = "﻿";

const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;
const NUMERIC_VALUE_PATTERN = /^-?\d+(?:[.,]\d+)?$/;
const LINE_BREAK_OR_QUOTE_PATTERN = /["\r\n]/;

export type CsvCellValue = string | number | null | undefined;

export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => CsvCellValue;
};

export function escapeCsvCell(rawValue: CsvCellValue, delimiter: string): string {
  if (rawValue === null || rawValue === undefined) {
    return "";
  }

  let cell = String(rawValue);
  // Neutralise spreadsheet formulas (CSV injection) but keep negative numbers intact.
  if (FORMULA_PREFIX_PATTERN.test(cell) && !NUMERIC_VALUE_PATTERN.test(cell)) {
    cell = `'${cell}`;
  }
  if (cell.includes(delimiter) || LINE_BREAK_OR_QUOTE_PATTERN.test(cell)) {
    cell = `"${cell.replaceAll('"', '""')}"`;
  }
  return cell;
}

/** `delimiter` follows the spreadsheet locale: ";" for German Excel, "," for English. */
export function buildCsv<Row>(columns: CsvColumn<Row>[], rows: Row[], delimiter: string): string {
  const headerLine = columns.map((column) => escapeCsvCell(column.header, delimiter)).join(delimiter);
  const dataLines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row), delimiter)).join(delimiter),
  );
  return UTF8_BOM + [headerLine, ...dataLines].join(CSV_LINE_BREAK) + CSV_LINE_BREAK;
}
