export const DEFAULT_PAGE_SIZE = 20;

export type SearchParamValue = string | string[] | undefined;
export type SearchParams = Record<string, SearchParamValue>;

export type PaginatedResult<Row> = {
  rows: Row[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parses `?page=` into a positive integer, defaulting to the first page. */
export function parsePageParam(value: SearchParamValue): number {
  const page = Number.parseInt(firstParam(value) ?? "", 10);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

/** Returns the param if it is one of the allowed values, otherwise the fallback. */
export function parseChoiceParam<Value extends string>(
  value: SearchParamValue,
  allowedValues: readonly Value[],
  fallback: Value,
): Value {
  const candidate = firstParam(value);
  return allowedValues.find((allowedValue) => allowedValue === candidate) ?? fallback;
}

export function toPaginatedResult<Row>(
  rows: Row[],
  totalCount: number,
  page: number,
  pageSize: number,
): PaginatedResult<Row> {
  return { rows, totalCount, page, pageSize, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)) };
}
