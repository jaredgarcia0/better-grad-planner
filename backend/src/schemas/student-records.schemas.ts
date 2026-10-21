import { z } from "zod";
import {
  booleanSchema,
  integerSchema,
  optionalCreditsSchema,
  optionalDateSchema,
  optionalStringSchema,
  requiredStringSchema,
  uuidSchema,
} from "../utils/parse.js";

const degreePlanStatusSchema = z.enum(["DRAFT", "ARCHIVED", "DECLARED"]);

const pageQuerySchema = z.object({
  page: z.preprocess(
    (value) => (value === undefined ? 1 : value),
    z.coerce.number().int().min(1),
  ),
  pageSize: z.preprocess(
    (value) => (value === undefined ? 25 : value),
    z.coerce.number().int().min(1).max(100),
  ),
});

const updateSchema = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  z.preprocess(
    (value, context) => {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      ) {
        context.addIssue({
          code: "custom",
          message: "At least one field must be supplied for an update.",
        });
        return z.NEVER;
      }

      return value;
    },
    schema.partial(),
  );

export const idParamsSchema = z.object({ id: uuidSchema });
export const planIdParamsSchema = z.object({ planId: uuidSchema });
export const planCourseParamsSchema = z.object({
  planId: uuidSchema,
  courseEntryId: uuidSchema,
});

export const listDegreePlansSchema = pageQuerySchema.extend({
  status: degreePlanStatusSchema.optional(),
});
const degreePlanFields = {
  programId: uuidSchema,
  name: requiredStringSchema,
  notes: optionalStringSchema,
  status: degreePlanStatusSchema,
  isDefault: booleanSchema,
};
export const createDegreePlanSchema = z.object({
  ...degreePlanFields,
  status: degreePlanStatusSchema.default("DRAFT"),
  isDefault: booleanSchema.default(false),
});
export const updateDegreePlanSchema = updateSchema(z.object(degreePlanFields));

export const listPlannedCoursesSchema = pageQuerySchema.extend({
  termId: uuidSchema.optional(),
});
const plannedCourseFields = {
  courseId: uuidSchema,
  termId: uuidSchema.nullable().optional(),
  sequence: integerSchema.min(0),
  notes: optionalStringSchema,
};
export const createPlannedCourseSchema = z.object({
  ...plannedCourseFields,
  sequence: integerSchema.min(0).default(0),
});
export const updatePlannedCourseSchema = updateSchema(z.object(plannedCourseFields));

export const listCompletedCoursesSchema = pageQuerySchema;
export const createCompletedCourseSchema = z.object({
  courseId: uuidSchema,
  termId: uuidSchema.nullable().optional(),
  grade: optionalStringSchema,
  creditsEarned: optionalCreditsSchema,
  completedOn: optionalDateSchema,
});
export const updateCompletedCourseSchema = updateSchema(createCompletedCourseSchema);

export const listTransferCoursesSchema = pageQuerySchema;
export const createTransferCourseSchema = z.object({
  courseId: uuidSchema,
  grade: optionalStringSchema,
  transferSource: optionalStringSchema,
  creditsEarned: optionalCreditsSchema,
  completedOn: optionalDateSchema,
});
export const updateTransferCourseSchema = updateSchema(createTransferCourseSchema);

