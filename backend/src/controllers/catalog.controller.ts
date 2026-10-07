import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import {
  optionalBoolean,
  optionalDate,
  optionalEnum,
  optionalInteger,
  optionalString,
  pagination,
  queryString,
  requiredDate,
  requiredEnum,
  requiredInteger,
  requiredString,
  response,
  uuid,
} from "../utils/parse.js";

type Body = Record<string, unknown>;
type Model = {
  findMany: (args: any) => Promise<any[]>;
  count: (args: any) => Promise<number>;
  findUnique: (args: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

const degreeTypes = [
  "ASSOCIATE",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
  "CERTIFICATE",
  "OTHER",
] as const;
const requirementTypes = [
  "REQUIRED",
  "ELECTIVE",
  "CONCENTRATION",
  "GENERAL_EDUCATION",
  "CAPSTONE",
  "OTHER",
] as const;
const requirementOperators = ["ALL", "ANY"] as const;
const prerequisiteTypes = ["PREREQUISITE", "COREQUISITE"] as const;
const courseLevels = [
  "INTRODUCTORY",
  "INTERMEDIATE",
  "ADVANCED",
  "GRADUATE",
] as const;

function body(req: Request): Body {
  return (req.body ?? {}) as Body;
}

function has(input: Body, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function idFrom(req: Request, field = "id"): string {
  const value = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  return uuid(value, field);
}

async function listResource(
  req: Request,
  res: Response,
  model: Model,
  where: Record<string, unknown> = {},
  orderBy: Record<string, string> = { name: "asc" },
) {
  const page = pagination(req.query as Record<string, unknown>);
  const [data, total] = await Promise.all([
    model.findMany({ where, orderBy, skip: page.skip, take: page.take }),
    model.count({ where }),
  ]);
  res.json(response(data, page, total));
}

async function getResource(req: Request, res: Response, model: Model) {
  const record = await model.findUnique({ where: { id: idFrom(req) } });
  if (!record) throw new HttpError(404, "The requested record was not found.");
  res.json({ data: record });
}

async function createResource(
  req: Request,
  res: Response,
  model: Model,
  data: Record<string, unknown>,
) {
  const record = await model.create({ data });
  res.status(201).json({ data: record });
}

async function updateResource(
  req: Request,
  res: Response,
  model: Model,
  data: Record<string, unknown>,
) {
  if (Object.keys(data).length === 0) {
    throw new HttpError(
      400,
      "At least one field must be supplied for an update.",
    );
  }
  const record = await model.update({ where: { id: idFrom(req) }, data });
  res.json({ data: record });
}

async function deleteResource(req: Request, res: Response, model: Model) {
  await model.delete({ where: { id: idFrom(req) } });
  res.status(204).send();
}

// Universities
export const listUniversities = asyncHandler(async (req, res) => {
  const q = queryString(req.query.q);
  await listResource(
    req,
    res,
    prisma.university,
    q ? { name: { contains: q, mode: "insensitive" } } : {},
  );
});

export const getUniversity = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.university),
);

export const createUniversity = asyncHandler(async (req, res) => {
  const input = body(req);
  await createResource(req, res, prisma.university, {
    name: requiredString(input.name, "name"),
    shortName: optionalString(input.shortName, "shortName"),
    websiteUrl: optionalString(input.websiteUrl, "websiteUrl"),
  });
});

export const updateUniversity = asyncHandler(async (req, res) => {
  const input = body(req);
  const data: Body = {};
  if (has(input, "name")) data.name = requiredString(input.name, "name");
  if (has(input, "shortName"))
    data.shortName = optionalString(input.shortName, "shortName");
  if (has(input, "websiteUrl"))
    data.websiteUrl = optionalString(input.websiteUrl, "websiteUrl");
  await updateResource(req, res, prisma.university, data);
});

export const deleteUniversity = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.university),
);

export const listUniversityDepartments = asyncHandler(async (req, res) => {
  const universityId = idFrom(req);
  const q = queryString(req.query.q);
  await listResource(req, res, prisma.department, {
    universityId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  });
});

export const listUniversityPrograms = asyncHandler(async (req, res) => {
  const universityId = idFrom(req);
  const q = queryString(req.query.q);
  await listResource(req, res, prisma.degreeProgram, {
    universityId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  });
});

export const listUniversityCourses = asyncHandler(async (req, res) => {
  const universityId = idFrom(req);
  const q = queryString(req.query.q);
  await listResource(
    req,
    res,
    prisma.course,
    {
      universityId,
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    { code: "asc" },
  );
});

// Departments
export const listDepartments = asyncHandler(async (req, res) => {
  const q = queryString(req.query.q);
  const universityId = queryString(req.query.universityId);
  await listResource(
    req,
    res,
    prisma.department,
    {
      ...(universityId
        ? { universityId: uuid(universityId, "universityId") }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    { name: "asc" },
  );
});

export const getDepartment = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.department),
);

export const createDepartment = asyncHandler(async (req, res) => {
  const input = body(req);
  await createResource(req, res, prisma.department, {
    universityId: uuid(
      requiredString(input.universityId, "universityId"),
      "universityId",
    ),
    code: requiredString(input.code, "code"),
    name: requiredString(input.name, "name"),
  });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const input = body(req);
  const data: Body = {};
  if (has(input, "universityId"))
    data.universityId = uuid(
      requiredString(input.universityId, "universityId"),
      "universityId",
    );
  if (has(input, "code")) data.code = requiredString(input.code, "code");
  if (has(input, "name")) data.name = requiredString(input.name, "name");
  await updateResource(req, res, prisma.department, data);
});

export const deleteDepartment = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.department),
);

// Degree programs
export const listPrograms = asyncHandler(async (req, res) => {
  const q = queryString(req.query.q);
  const universityId = queryString(req.query.universityId);
  const degreeType = optionalEnum(
    req.query.degreeType,
    "degreeType",
    degreeTypes,
  );
  const catalogYear =
    req.query.catalogYear === undefined
      ? undefined
      : requiredInteger(req.query.catalogYear, "catalogYear");
  await listResource(req, res, prisma.degreeProgram, {
    ...(universityId
      ? { universityId: uuid(universityId, "universityId") }
      : {}),
    ...(degreeType ? { degreeType } : {}),
    ...(catalogYear !== undefined ? { catalogYear } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  });
});

export const getProgram = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.degreeProgram),
);

export const createProgram = asyncHandler(async (req, res) => {
  const input = body(req);
  await createResource(req, res, prisma.degreeProgram, {
    universityId: uuid(
      requiredString(input.universityId, "universityId"),
      "universityId",
    ),
    code: requiredString(input.code, "code"),
    name: requiredString(input.name, "name"),
    degreeType: requiredEnum(input.degreeType, "degreeType", degreeTypes),
    catalogYear: optionalInteger(input.catalogYear, "catalogYear"),
    description: optionalString(input.description, "description"),
    totalCredits: optionalInteger(input.totalCredits, "totalCredits"),
  });
});

export const updateProgram = asyncHandler(async (req, res) => {
  const input = body(req);
  const data: Body = {};
  if (has(input, "universityId"))
    data.universityId = uuid(
      requiredString(input.universityId, "universityId"),
      "universityId",
    );
  if (has(input, "code")) data.code = requiredString(input.code, "code");
  if (has(input, "name")) data.name = requiredString(input.name, "name");
  if (has(input, "degreeType"))
    data.degreeType = requiredEnum(input.degreeType, "degreeType", degreeTypes);
  if (has(input, "catalogYear"))
    data.catalogYear = optionalInteger(input.catalogYear, "catalogYear");
  if (has(input, "description"))
    data.description = optionalString(input.description, "description");
  if (has(input, "totalCredits"))
    data.totalCredits = optionalInteger(input.totalCredits, "totalCredits");
  await updateResource(req, res, prisma.degreeProgram, data);
});

export const deleteProgram = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.degreeProgram),
);

export const listProgramRequirements = asyncHandler(async (req, res) => {
  const programId = idFrom(req);
  const q = queryString(req.query.q);
  await listResource(
    req,
    res,
    prisma.requirementGroup,
    {
      programId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    { sequence: "asc" },
  );
});

// Requirement groups
export const listRequirements = asyncHandler(async (req, res) => {
  const programId = queryString(req.query.programId);
  const parentId = queryString(req.query.parentId);
  const requirementType = optionalEnum(
    req.query.requirementType,
    "requirementType",
    requirementTypes,
  );
  const operator = optionalEnum(
    req.query.operator,
    "operator",
    requirementOperators,
  );
  await listResource(
    req,
    res,
    prisma.requirementGroup,
    {
      ...(programId ? { programId: uuid(programId, "programId") } : {}),
      ...(parentId ? { parentId: uuid(parentId, "parentId") } : {}),
      ...(requirementType ? { requirementType } : {}),
      ...(operator ? { operator } : {}),
    },
    { sequence: "asc" },
  );
});

export const getRequirement = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.requirementGroup),
);

export const createRequirement = asyncHandler(async (req, res) => {
  const input = body(req);
  await createResource(req, res, prisma.requirementGroup, {
    programId: uuid(requiredString(input.programId, "programId"), "programId"),
    parentId:
      input.parentId === null
        ? null
        : input.parentId === undefined
          ? undefined
          : uuid(requiredString(input.parentId, "parentId"), "parentId"),
    name: requiredString(input.name, "name"),
    description: optionalString(input.description, "description"),
    requirementType: requiredEnum(
      input.requirementType,
      "requirementType",
      requirementTypes,
    ),
    operator:
      input.operator === undefined
        ? "ALL"
        : requiredEnum(input.operator, "operator", requirementOperators),
    sequence:
      input.sequence === undefined
        ? 0
        : requiredInteger(input.sequence, "sequence"),
    minCourses: optionalInteger(input.minCourses, "minCourses"),
    maxCourses: optionalInteger(input.maxCourses, "maxCourses"),
    minCredits: optionalInteger(input.minCredits, "minCredits"),
    maxCredits: optionalInteger(input.maxCredits, "maxCredits"),
  });
});

export const updateRequirement = asyncHandler(async (req, res) => {
  const input = body(req);
  const data: Body = {};
  if (has(input, "programId"))
    data.programId = uuid(
      requiredString(input.programId, "programId"),
      "programId",
    );
  if (has(input, "parentId"))
    data.parentId =
      input.parentId === null
        ? null
        : uuid(requiredString(input.parentId, "parentId"), "parentId");
  if (has(input, "name")) data.name = requiredString(input.name, "name");
  if (has(input, "description"))
    data.description = optionalString(input.description, "description");
  if (has(input, "requirementType"))
    data.requirementType = requiredEnum(
      input.requirementType,
      "requirementType",
      requirementTypes,
    );
  if (has(input, "operator"))
    data.operator = requiredEnum(
      input.operator,
      "operator",
      requirementOperators,
    );
  if (has(input, "sequence"))
    data.sequence = requiredInteger(input.sequence, "sequence");
  if (has(input, "minCourses"))
    data.minCourses = optionalInteger(input.minCourses, "minCourses");
  if (has(input, "maxCourses"))
    data.maxCourses = optionalInteger(input.maxCourses, "maxCourses");
  if (has(input, "minCredits"))
    data.minCredits = optionalInteger(input.minCredits, "minCredits");
  if (has(input, "maxCredits"))
    data.maxCredits = optionalInteger(input.maxCredits, "maxCredits");
  await updateResource(req, res, prisma.requirementGroup, data);
});

export const deleteRequirement = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.requirementGroup),
);

export const listRequirementCourses = asyncHandler(async (req, res) => {
  const requirementId = idFrom(req);
  await listResource(
    req,
    res,
    prisma.requirementCourse,
    { requirementId },
    { sequence: "asc" },
  );
});

// Courses
export const listCourses = asyncHandler(async (req, res) => {
  const q = queryString(req.query.q);
  const universityId = queryString(req.query.universityId);
  const departmentId = queryString(req.query.departmentId);
  const level = optionalEnum(req.query.level, "level", courseLevels);
  const active = optionalBoolean(req.query.active, "active");
  await listResource(
    req,
    res,
    prisma.course,
    {
      ...(universityId
        ? { universityId: uuid(universityId, "universityId") }
        : {}),
      ...(departmentId
        ? { departmentId: uuid(departmentId, "departmentId") }
        : {}),
      ...(level ? { level } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    { code: "asc" },
  );
});

export const getCourse = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.course),
);

export const createCourse = asyncHandler(async (req, res) => {
  const input = body(req);
  await createResource(req, res, prisma.course, {
    universityId: uuid(
      requiredString(input.universityId, "universityId"),
      "universityId",
    ),
    departmentId:
      input.departmentId === null
        ? null
        : input.departmentId === undefined
          ? undefined
          : uuid(
              requiredString(input.departmentId, "departmentId"),
              "departmentId",
            ),
    code: requiredString(input.code, "code"),
    title: requiredString(input.title, "title"),
    description: optionalString(input.description, "description"),
    credits: requiredInteger(input.credits, "credits"),
    level: optionalEnum(input.level, "level", courseLevels),
    active:
      input.active === undefined
        ? true
        : optionalBoolean(input.active, "active"),
  });
});

export const updateCourse = asyncHandler(async (req, res) => {
  const input = body(req);
  const data: Body = {};
  if (has(input, "universityId"))
    data.universityId = uuid(
      requiredString(input.universityId, "universityId"),
      "universityId",
    );
  if (has(input, "departmentId"))
    data.departmentId =
      input.departmentId === null
        ? null
        : uuid(
            requiredString(input.departmentId, "departmentId"),
            "departmentId",
          );
  if (has(input, "code")) data.code = requiredString(input.code, "code");
  if (has(input, "title")) data.title = requiredString(input.title, "title");
  if (has(input, "description"))
    data.description = optionalString(input.description, "description");
  if (has(input, "credits"))
    data.credits = requiredInteger(input.credits, "credits");
  if (has(input, "level"))
    data.level = optionalEnum(input.level, "level", courseLevels);
  if (has(input, "active"))
    data.active = optionalBoolean(input.active, "active");
  await updateResource(req, res, prisma.course, data);
});

export const deleteCourse = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.course),
);

export const listCoursePrerequisites = asyncHandler(async (req, res) => {
  const courseId = idFrom(req);
  await listResource(
    req,
    res,
    prisma.coursePrerequisite,
    { courseId },
    { groupNumber: "asc" },
  );
});

export const listCourseOfferings = asyncHandler(async (req, res) => {
  const courseId = idFrom(req);
  await listResource(
    req,
    res,
    prisma.courseOffering,
    { courseId },
    { termId: "asc" },
  );
});

// Requirement-course links
export const listRequirementCourseLinks = asyncHandler(async (req, res) => {
  const requirementId = queryString(req.query.requirementId);
  const courseId = queryString(req.query.courseId);
  await listResource(
    req,
    res,
    prisma.requirementCourse,
    {
      ...(requirementId
        ? { requirementId: uuid(requirementId, "requirementId") }
        : {}),
      ...(courseId ? { courseId: uuid(courseId, "courseId") } : {}),
    },
    { sequence: "asc" },
  );
});

export const getRequirementCourseLink = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.requirementCourse),
);

export const createRequirementCourseLink = asyncHandler(async (req, res) => {
  const input = body(req);
  await createResource(req, res, prisma.requirementCourse, {
    requirementId: uuid(
      requiredString(input.requirementId, "requirementId"),
      "requirementId",
    ),
    courseId: uuid(requiredString(input.courseId, "courseId"), "courseId"),
    sequence:
      input.sequence === undefined
        ? 0
        : requiredInteger(input.sequence, "sequence"),
    minGrade: optionalString(input.minGrade, "minGrade"),
    creditsOverride: optionalInteger(input.creditsOverride, "creditsOverride"),
  });
});

export const updateRequirementCourseLink = asyncHandler(async (req, res) => {
  const input = body(req);
  const data: Body = {};
  if (has(input, "requirementId"))
    data.requirementId = uuid(
      requiredString(input.requirementId, "requirementId"),
      "requirementId",
    );
  if (has(input, "courseId"))
    data.courseId = uuid(
      requiredString(input.courseId, "courseId"),
      "courseId",
    );
  if (has(input, "sequence"))
    data.sequence = requiredInteger(input.sequence, "sequence");
  if (has(input, "minGrade"))
    data.minGrade = optionalString(input.minGrade, "minGrade");
  if (has(input, "creditsOverride"))
    data.creditsOverride = optionalInteger(
      input.creditsOverride,
      "creditsOverride",
    );
  await updateResource(req, res, prisma.requirementCourse, data);
});

export const deleteRequirementCourseLink = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.requirementCourse),
);

// Course prerequisites
export const listPrerequisites = asyncHandler(async (req, res) => {
  const courseId = queryString(req.query.courseId);
  const prerequisiteCourseId = queryString(req.query.prerequisiteCourseId);
  const type = optionalEnum(req.query.type, "type", prerequisiteTypes);
  await listResource(
    req,
    res,
    prisma.coursePrerequisite,
    {
      ...(courseId ? { courseId: uuid(courseId, "courseId") } : {}),
      ...(prerequisiteCourseId
        ? {
            prerequisiteCourseId: uuid(
              prerequisiteCourseId,
              "prerequisiteCourseId",
            ),
          }
        : {}),
      ...(type ? { type } : {}),
    },
    { groupNumber: "asc" },
  );
});

export const getPrerequisite = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.coursePrerequisite),
);

export const createPrerequisite = asyncHandler(async (req, res) => {
  const input = body(req);
  await createResource(req, res, prisma.coursePrerequisite, {
    courseId: uuid(requiredString(input.courseId, "courseId"), "courseId"),
    prerequisiteCourseId: uuid(
      requiredString(input.prerequisiteCourseId, "prerequisiteCourseId"),
      "prerequisiteCourseId",
    ),
    type:
      input.type === undefined
        ? "PREREQUISITE"
        : requiredEnum(input.type, "type", prerequisiteTypes),
    groupNumber:
      input.groupNumber === undefined
        ? 0
        : requiredInteger(input.groupNumber, "groupNumber"),
    isAlternative:
      input.isAlternative === undefined
        ? false
        : optionalBoolean(input.isAlternative, "isAlternative"),
    minimumGrade: optionalString(input.minimumGrade, "minimumGrade"),
  });
});

export const updatePrerequisite = asyncHandler(async (req, res) => {
  const input = body(req);
  const data: Body = {};
  if (has(input, "courseId"))
    data.courseId = uuid(
      requiredString(input.courseId, "courseId"),
      "courseId",
    );
  if (has(input, "prerequisiteCourseId"))
    data.prerequisiteCourseId = uuid(
      requiredString(input.prerequisiteCourseId, "prerequisiteCourseId"),
      "prerequisiteCourseId",
    );
  if (has(input, "type"))
    data.type = requiredEnum(input.type, "type", prerequisiteTypes);
  if (has(input, "groupNumber"))
    data.groupNumber = requiredInteger(input.groupNumber, "groupNumber");
  if (has(input, "isAlternative"))
    data.isAlternative = optionalBoolean(input.isAlternative, "isAlternative");
  if (has(input, "minimumGrade"))
    data.minimumGrade = optionalString(input.minimumGrade, "minimumGrade");
  await updateResource(req, res, prisma.coursePrerequisite, data);
});

export const deletePrerequisite = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.coursePrerequisite),
);

// Academic terms
export const listTerms = asyncHandler(async (req, res) => {
  const q = queryString(req.query.q);
  const universityId = queryString(req.query.universityId);
  await listResource(
    req,
    res,
    prisma.academicTerm,
    {
      ...(universityId
        ? { universityId: uuid(universityId, "universityId") }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    { startsOn: "asc" },
  );
});

export const getTerm = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.academicTerm),
);

export const createTerm = asyncHandler(async (req, res) => {
  const input = body(req);
  await createResource(req, res, prisma.academicTerm, {
    universityId: uuid(
      requiredString(input.universityId, "universityId"),
      "universityId",
    ),
    name: requiredString(input.name, "name"),
    code: requiredString(input.code, "code"),
    startsOn: requiredDate(input.startsOn, "startsOn"),
    endsOn: requiredDate(input.endsOn, "endsOn"),
  });
});

export const updateTerm = asyncHandler(async (req, res) => {
  const input = body(req);
  const data: Body = {};
  if (has(input, "universityId"))
    data.universityId = uuid(
      requiredString(input.universityId, "universityId"),
      "universityId",
    );
  if (has(input, "name")) data.name = requiredString(input.name, "name");
  if (has(input, "code")) data.code = requiredString(input.code, "code");
  if (has(input, "startsOn"))
    data.startsOn = requiredDate(input.startsOn, "startsOn");
  if (has(input, "endsOn")) data.endsOn = requiredDate(input.endsOn, "endsOn");
  await updateResource(req, res, prisma.academicTerm, data);
});

export const deleteTerm = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.academicTerm),
);

export const listTermOfferings = asyncHandler(async (req, res) => {
  const termId = idFrom(req);
  await listResource(
    req,
    res,
    prisma.courseOffering,
    { termId },
    { courseId: "asc" },
  );
});

// Course offerings
export const listOfferings = asyncHandler(async (req, res) => {
  const courseId = queryString(req.query.courseId);
  const termId = queryString(req.query.termId);
  await listResource(
    req,
    res,
    prisma.courseOffering,
    {
      ...(courseId ? { courseId: uuid(courseId, "courseId") } : {}),
      ...(termId ? { termId: uuid(termId, "termId") } : {}),
    },
    { termId: "asc" },
  );
});

export const getOffering = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.courseOffering),
);

export const createOffering = asyncHandler(async (req, res) => {
  const input = body(req);
  await createResource(req, res, prisma.courseOffering, {
    courseId: uuid(requiredString(input.courseId, "courseId"), "courseId"),
    termId: uuid(requiredString(input.termId, "termId"), "termId"),
    sectionCode: optionalString(input.sectionCode, "sectionCode"),
    instructor: optionalString(input.instructor, "instructor"),
    meetingInfo: optionalString(input.meetingInfo, "meetingInfo"),
    capacity: optionalInteger(input.capacity, "capacity"),
    seatsOpen: optionalInteger(input.seatsOpen, "seatsOpen"),
  });
});

export const updateOffering = asyncHandler(async (req, res) => {
  const input = body(req);
  const data: Body = {};
  if (has(input, "courseId"))
    data.courseId = uuid(
      requiredString(input.courseId, "courseId"),
      "courseId",
    );
  if (has(input, "termId"))
    data.termId = uuid(requiredString(input.termId, "termId"), "termId");
  if (has(input, "sectionCode"))
    data.sectionCode = optionalString(input.sectionCode, "sectionCode");
  if (has(input, "instructor"))
    data.instructor = optionalString(input.instructor, "instructor");
  if (has(input, "meetingInfo"))
    data.meetingInfo = optionalString(input.meetingInfo, "meetingInfo");
  if (has(input, "capacity"))
    data.capacity = optionalInteger(input.capacity, "capacity");
  if (has(input, "seatsOpen"))
    data.seatsOpen = optionalInteger(input.seatsOpen, "seatsOpen");
  await updateResource(req, res, prisma.courseOffering, data);
});

export const deleteOffering = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.courseOffering),
);
