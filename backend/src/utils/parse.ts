import { HttpError } from "./httpError.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuid(value: string | undefined, field = "id"): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new HttpError(400, `${field} must be a valid UUID.`);
  }
  return value;
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} is required and must be a non-empty string.`);
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string or null.`);
  }
  return value.trim();
}

export function requiredInteger(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    throw new HttpError(400, `${field} must be an integer.`);
  }
  return parsed;
}

export function optionalInteger(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return requiredInteger(value, field);
}

export function optionalBoolean(value: unknown, field: string): boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new HttpError(400, `${field} must be true or false.`);
}

export function requiredEnum<T extends string>(value: unknown, field: string, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new HttpError(400, `${field} must be one of: ${values.join(", ")}.`);
  }
  return value as T;
}

export function optionalEnum<T extends string>(value: unknown, field: string, values: readonly T[]): T | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return requiredEnum(value, field, values);
}

export function requiredDate(value: unknown, field: string): Date {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new HttpError(400, `${field} must be a valid ISO date.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${field} must be a valid ISO date.`);
  }
  return date;
}

export function optionalDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return requiredDate(value, field);
}

export function pagination(query: Record<string, unknown>) {
  const pageValue = query.page === undefined ? 1 : Number(query.page);
  const pageSizeValue = query.pageSize === undefined ? 25 : Number(query.pageSize);

  if (!Number.isInteger(pageValue) || pageValue < 1) {
    throw new HttpError(400, "page must be a positive integer.");
  }
  if (!Number.isInteger(pageSizeValue) || pageSizeValue < 1 || pageSizeValue > 100) {
    throw new HttpError(400, "pageSize must be an integer between 1 and 100.");
  }

  return {
    page: pageValue,
    pageSize: pageSizeValue,
    skip: (pageValue - 1) * pageSizeValue,
    take: pageSizeValue,
  };
}

export function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function response<T>(data: T, page?: ReturnType<typeof pagination>, total?: number) {
  if (!page || total === undefined) return { data };
  return {
    data,
    pagination: {
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages: Math.ceil(total / page.pageSize),
    },
  };
}
