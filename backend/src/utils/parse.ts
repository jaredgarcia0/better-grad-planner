import { z, type ZodType } from "zod";
import { HttpError } from "./httpError.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Shared schemas used by the API's request validation layer. */
export const uuidSchema = z
  .string()
  .regex(UUID_PATTERN, "must be a valid UUID");
export const requiredStringSchema = z
  .string()
  .trim()
  .min(1, "is required and must be a non-empty string");
export const optionalStringSchema = z.string().trim().nullable().optional();
export const integerSchema = z.coerce.number().int("must be an integer");
export const optionalIntegerSchema = z.preprocess(
  (value) => (value === null ? null : value),
  integerSchema.nullable().optional(),
);
export const booleanSchema = z.preprocess(
  (value) => (value === "true" ? true : value === "false" ? false : value),
  z.boolean("must be true or false"),
);
export const optionalBooleanSchema = booleanSchema.nullable().optional();
export const dateSchema = z.coerce.date("must be a valid ISO date");
export const optionalDateSchema = z.preprocess(
  (value) => (value === null ? null : value),
  dateSchema.nullable().optional(),
);
export const queryStringSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z.string().optional(),
);

export const paginationSchema = z
  .object({
    page: z.preprocess(
      (value) => (value === undefined ? 1 : value),
      z.coerce.number().int().min(1, "must be a positive integer"),
    ),
    pageSize: z.preprocess(
      (value) => (value === undefined ? 25 : value),
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100, "must be an integer between 1 and 100"),
    ),
  })
  .transform(({ page, pageSize }) => ({
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  }));

export const enumSchema = <T extends string>(values: readonly T[]) =>
  z.enum(values as [T, ...T[]]);

/** Convert Zod's structured validation failures into the API's existing 400 error shape. */
export function parseSchema<T>(
  schema: ZodType<T>,
  value: unknown,
  field?: string,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const issueField = field ?? issue?.path.join(".");
  const message =
    issueField && issue?.message && !issue.message.startsWith(issueField)
      ? `${issueField} ${issue.message}.`
      : `${issue?.message ?? "Invalid request."}`;
  throw new HttpError(400, message, result.error.flatten());
}

// Compatibility adapters for the controller while request schemas are migrated resource-by-resource.
// All validation now runs through the Zod schemas above; these functions contain no hand-written parsing.
export function uuid(value: string | undefined, field = "id"): string {
  return parseSchema(uuidSchema, value, field);
}
export function requiredString(value: unknown, field: string): string {
  return parseSchema(requiredStringSchema, value, field);
}
export function optionalString(
  value: unknown,
  field: string,
): string | null | undefined {
  return parseSchema(optionalStringSchema, value, field);
}
export function requiredInteger(value: unknown, field: string): number {
  return parseSchema(integerSchema, value, field);
}
export function optionalInteger(
  value: unknown,
  field: string,
): number | null | undefined {
  return parseSchema(optionalIntegerSchema, value, field);
}
export function optionalBoolean(
  value: unknown,
  field: string,
): boolean | null | undefined {
  return parseSchema(optionalBooleanSchema, value, field);
}
export function requiredEnum<T extends string>(
  value: unknown,
  field: string,
  values: readonly T[],
): T {
  return parseSchema(enumSchema(values), value, field);
}
export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  values: readonly T[],
): T | null | undefined {
  return parseSchema(enumSchema(values).nullable().optional(), value, field);
}
export function requiredDate(value: unknown, field: string): Date {
  return parseSchema(dateSchema, value, field);
}
export function optionalDate(
  value: unknown,
  field: string,
): Date | null | undefined {
  return parseSchema(optionalDateSchema, value, field);
}
export function pagination(query: Record<string, unknown>) {
  return parseSchema(paginationSchema, query);
}
export function queryString(value: unknown): string | undefined {
  return parseSchema(queryStringSchema, value);
}

export function response<T>(
  data: T,
  page?: ReturnType<typeof pagination>,
  total?: number,
) {
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
