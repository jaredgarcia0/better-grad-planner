import { describe, expect, it } from "vitest";
import {
  booleanSchema,
  dateSchema,
  optionalBoolean,
  optionalDate,
  optionalInteger,
  optionalString,
  pagination,
  parseSchema,
  queryString,
  requiredDate,
  requiredEnum,
  requiredInteger,
  requiredString,
  response,
  uuid,
} from "../../src/utils/parse.js";
import { HttpError } from "../../src/utils/httpError.js";

const validUuid = "123e4567-e89b-42d3-a456-426614174000";

describe("request parsing helpers", () => {
  it("parses UUIDs and reports the field in validation errors", () => {
    expect(uuid(validUuid)).toBe(validUuid);
    expect(() => uuid("not-a-uuid", "courseId")).toThrowError(
      "courseId must be a valid UUID.",
    );
  });

  it("trims required and optional strings while preserving null and undefined", () => {
    expect(requiredString("  Course  ", "title")).toBe("Course");
    expect(optionalString("  note  ", "note")).toBe("note");
    expect(optionalString(null, "note")).toBeNull();
    expect(optionalString(undefined, "note")).toBeUndefined();
    expect(optionalString("   ", "note")).toBeUndefined();
    expect(() => requiredString("   ", "title")).toThrowError(
      "title is required and must be a non-empty string.",
    );
  });

  it("coerces integers, booleans, and dates and rejects invalid values", () => {
    expect(requiredInteger("3", "credits")).toBe(3);
    expect(optionalInteger(null, "credits")).toBeNull();
    expect(optionalBoolean("true", "active")).toBe(true);
    expect(optionalBoolean("false", "active")).toBe(false);
    expect(optionalBoolean(null, "active")).toBeNull();
    expect(requiredDate("2026-01-02", "startsOn")).toBeInstanceOf(Date);
    expect(requiredDate("2026-01-02T09:30:00-06:00", "startsOn")).toBeInstanceOf(Date);
    expect(optionalDate(null, "endsOn")).toBeNull();
    expect(() => requiredInteger("3.5", "credits")).toThrow();
    expect(() => optionalBoolean("yes", "active")).toThrow();
    expect(() => parseSchema(dateSchema, "not-a-date", "startsOn")).toThrow(
      HttpError,
    );
    expect(() => parseSchema(dateSchema, "", "startsOn")).toThrow(HttpError);
    expect(() => parseSchema(dateSchema, "01/02/2026", "startsOn")).toThrow(HttpError);
    expect(() => parseSchema(dateSchema, "2026-02-30", "startsOn")).toThrow(HttpError);
    expect(booleanSchema.safeParse("yes").success).toBe(false);
  });

  it("applies pagination defaults, bounds, and skip/take calculations", () => {
    expect(pagination({})).toEqual({ page: 1, pageSize: 25, skip: 0, take: 25 });
    expect(pagination({ page: "2", pageSize: "100" })).toEqual({
      page: 2,
      pageSize: 100,
      skip: 100,
      take: 100,
    });
    expect(() => pagination({ page: "0" })).toThrow();
    expect(() => pagination({ pageSize: "101" })).toThrow();
    expect(() => pagination({ page: "one" })).toThrow();
    expect(() => pagination({ page: "" })).toThrow();
    expect(() => pagination({ page: "-1" })).toThrow();
    expect(() => pagination({ page: "1.5" })).toThrow();
    expect(() => pagination({ page: null })).toThrow();
    expect(() => pagination({ page: "Infinity" })).toThrow();
    expect(() => pagination({ page: ["1", "2"] })).toThrow();
  });

  it("normalizes query strings and validates enums", () => {
    expect(queryString("  computer science  ")).toBe("computer science");
    expect(queryString("   ")).toBeUndefined();
    expect(requiredEnum("BACHELOR", "degreeType", ["ASSOCIATE", "BACHELOR"])).toBe(
      "BACHELOR",
    );
    expect(() => requiredEnum("INVALID", "degreeType", ["ASSOCIATE", "BACHELOR"])).toThrow(
      "degreeType Invalid option",
    );
  });

  it("builds response envelopes for paginated and non-paginated data", () => {
    expect(response([{ id: 1 }])).toEqual({ data: [{ id: 1 }] });
    expect(response([], { page: 2, pageSize: 10, skip: 10, take: 10 }, 25)).toEqual({
      data: [],
      pagination: { page: 2, pageSize: 10, total: 25, totalPages: 3 },
    });
  });
});
