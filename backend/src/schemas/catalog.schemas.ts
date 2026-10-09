import { z } from "zod";
import {
  booleanSchema,
  dateSchema,
  integerSchema,
  optionalBooleanSchema,
  optionalIntegerSchema,
  optionalStringSchema,
  queryStringSchema,
  requiredStringSchema,
  uuidSchema,
} from "../utils/parse.js";

const degreeTypeSchema = z.enum([
  "ASSOCIATE",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
  "CERTIFICATE",
  "OTHER",
]);
const requirementTypeSchema = z.enum([
  "REQUIRED",
  "ELECTIVE",
  "CONCENTRATION",
  "GENERAL_EDUCATION",
  "CAPSTONE",
  "OTHER",
]);
const operatorSchema = z.enum(["ALL", "ANY"]);
const prerequisiteTypeSchema = z.enum(["PREREQUISITE", "COREQUISITE"]);
const courseLevelSchema = z.enum([
  "INTRODUCTORY",
  "INTERMEDIATE",
  "ADVANCED",
  "GRADUATE",
]);

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
const paginatedQuerySchema = pageQuerySchema;
const searchQuerySchema = paginatedQuerySchema.extend({ q: queryStringSchema });

export const listUniversitiesSchema = searchQuerySchema;
export const createUniversitySchema = z.object({
  name: requiredStringSchema,
  shortName: optionalStringSchema,
  websiteUrl: optionalStringSchema,
});
export const updateUniversitySchema = updateSchema(createUniversitySchema);

export const universityChildQuerySchema = searchQuerySchema;
export const listDepartmentsSchema = paginatedQuerySchema.extend({
  q: queryStringSchema,
  universityId: uuidSchema.optional(),
});
export const createDepartmentSchema = z.object({
  universityId: uuidSchema,
  code: requiredStringSchema,
  name: requiredStringSchema,
});
export const updateDepartmentSchema = updateSchema(createDepartmentSchema);

export const listProgramsSchema = paginatedQuerySchema.extend({
  q: queryStringSchema,
  universityId: uuidSchema.optional(),
  degreeType: degreeTypeSchema.optional(),
  catalogYear: integerSchema.optional(),
});
export const createProgramSchema = z.object({
  universityId: uuidSchema,
  code: requiredStringSchema,
  name: requiredStringSchema,
  degreeType: degreeTypeSchema,
  catalogYear: optionalIntegerSchema,
  description: optionalStringSchema,
  totalCredits: optionalIntegerSchema,
});
export const updateProgramSchema = updateSchema(createProgramSchema);

export const listRequirementsSchema = paginatedQuerySchema.extend({
  programId: uuidSchema.optional(),
  parentId: uuidSchema.optional(),
  requirementType: requirementTypeSchema.optional(),
  operator: operatorSchema.optional(),
});
export const createRequirementSchema = z.object({
  programId: uuidSchema,
  parentId: uuidSchema.nullable().optional(),
  name: requiredStringSchema,
  description: optionalStringSchema,
  requirementType: requirementTypeSchema,
  operator: operatorSchema.default("ALL"),
  sequence: integerSchema.default(0),
  minCourses: optionalIntegerSchema,
  maxCourses: optionalIntegerSchema,
  minCredits: optionalIntegerSchema,
  maxCredits: optionalIntegerSchema,
});
export const updateRequirementSchema = updateSchema(createRequirementSchema);

export const listCoursesSchema = paginatedQuerySchema.extend({
  q: queryStringSchema,
  universityId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
  level: courseLevelSchema.optional(),
  active: booleanSchema.optional(),
});
export const createCourseSchema = z.object({
  universityId: uuidSchema,
  departmentId: uuidSchema.nullable().optional(),
  code: requiredStringSchema,
  title: requiredStringSchema,
  description: optionalStringSchema,
  credits: integerSchema,
  level: courseLevelSchema.nullable().optional(),
  active: optionalBooleanSchema.default(true),
});
export const updateCourseSchema = updateSchema(createCourseSchema);

export const listRequirementCoursesSchema = paginatedQuerySchema.extend({
  requirementId: uuidSchema.optional(),
  courseId: uuidSchema.optional(),
});
export const createRequirementCourseSchema = z.object({
  requirementId: uuidSchema,
  courseId: uuidSchema,
  sequence: integerSchema.default(0),
  minGrade: optionalStringSchema,
  creditsOverride: optionalIntegerSchema,
});
export const updateRequirementCourseSchema = updateSchema(
  createRequirementCourseSchema,
);

export const listPrerequisitesSchema = paginatedQuerySchema.extend({
  courseId: uuidSchema.optional(),
  prerequisiteCourseId: uuidSchema.optional(),
  type: prerequisiteTypeSchema.optional(),
});
export const createPrerequisiteSchema = z.object({
  courseId: uuidSchema,
  prerequisiteCourseId: uuidSchema,
  type: prerequisiteTypeSchema.default("PREREQUISITE"),
  groupNumber: integerSchema.default(0),
  isAlternative: optionalBooleanSchema.default(false),
  minimumGrade: optionalStringSchema,
});
export const updatePrerequisiteSchema = updateSchema(createPrerequisiteSchema);

export const listTermsSchema = paginatedQuerySchema.extend({
  q: queryStringSchema,
  universityId: uuidSchema.optional(),
});
export const createTermSchema = z.object({
  universityId: uuidSchema,
  name: requiredStringSchema,
  code: requiredStringSchema,
  startsOn: dateSchema,
  endsOn: dateSchema,
});
export const updateTermSchema = updateSchema(createTermSchema);

export const listOfferingsSchema = paginatedQuerySchema.extend({
  courseId: uuidSchema.optional(),
  termId: uuidSchema.optional(),
});
export const createOfferingSchema = z.object({
  courseId: uuidSchema,
  termId: uuidSchema,
  sectionCode: optionalStringSchema,
  instructor: optionalStringSchema,
  meetingInfo: optionalStringSchema,
  capacity: optionalIntegerSchema,
  seatsOpen: optionalIntegerSchema,
});
export const updateOfferingSchema = updateSchema(createOfferingSchema);

// Nested collection endpoints use the parent route parameter as a filter.
export const universityIdParamsSchema = idParamsSchema;
export const programIdParamsSchema = idParamsSchema;
export const requirementIdParamsSchema = idParamsSchema;
export const courseIdParamsSchema = idParamsSchema;
export const termIdParamsSchema = idParamsSchema;
