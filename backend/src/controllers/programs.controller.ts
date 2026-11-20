import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createResource,
  deleteResource,
  getResource,
  idFrom,
  listResource,
  queryValue,
  updateResource,
} from "./common.controller.js";
import { HttpError } from "../utils/httpError.js";

export const listPrograms = asyncHandler(async (req, res) => {
  const search = queryValue(req, "q");
  const universityId = queryValue(req, "universityId");
  await listResource(
    req,
    res,
    prisma.degreeProgram,
    {
      ...(universityId ? { universityId } : {}),
      ...(req.query.degreeType ? { degreeType: req.query.degreeType } : {}),
      ...(req.query.catalogYear !== undefined
        ? { catalogYear: Number(req.query.catalogYear) }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    { name: "asc" },
    {
      select: {
        id: true,
        universityId: true,
        code: true,
        name: true,
        degreeType: true,
        catalogYear: true,
        totalCredits: true,
        generalEducationProgramId: true,
      },
    },
  );
});
export const getProgram = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.degreeProgram),
);
export const createProgram = asyncHandler(async (req, res) =>
  createResource(req, res, prisma.degreeProgram),
);
export const updateProgram = asyncHandler(async (req, res) =>
  updateResource(req, res, prisma.degreeProgram),
);
export const deleteProgram = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.degreeProgram),
);

/** Returns the catalog-selected GE program applicable to the requested major. */
export const getMajorGeneralEducation = asyncHandler(async (req, res) => {
  const major = await prisma.degreeProgram.findUnique({
    where: { id: req.params.majorId as string },
    select: {
      generalEducationProgram: {
        select: {
          id: true,
          universityId: true,
          code: true,
          name: true,
          degreeType: true,
          catalogYear: true,
          totalCredits: true,
        },
      },
    },
  });
  if (!major) throw new HttpError(404, "The requested major was not found.");
  if (!major.generalEducationProgram) {
    throw new HttpError(404, "No general education program is configured for this major.");
  }
  res.json({ data: major.generalEducationProgram });
});

export const listProgramRequirements = asyncHandler(async (req, res) => {
  const search = queryValue(req, "q");
  const where = {
    programId: idFrom(req),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const select = {
    id: true,
    programId: true,
    parentId: true,
    name: true,
    description: true,
    requirementType: true,
    operator: true,
    sequence: true,
    minCourses: true,
    maxCourses: true,
    minCredits: true,
    maxCredits: true,
    courses: {
      orderBy: { sequence: "asc" as const },
      select: {
        id: true,
        requirementId: true,
        courseId: true,
        sequence: true,
        minGrade: true,
        creditsOverride: true,
        course: { select: { id: true, code: true, title: true, credits: true } },
      },
    },
  };

  // The legacy flat list remains the default. New clients opt into the tree
  // representation, avoiding a breaking API change for existing consumers.
  if (req.query.tree) {
    const groups = await prisma.requirementGroup.findMany({
      where,
      orderBy: { sequence: "asc" },
      select,
    });
    type Group = (typeof groups)[number] & { children: Group[] };
    const nodes = new Map<string, Group>(
      groups.map((group) => [group.id, { ...group, children: [] }]),
    );
    const roots: Group[] = [];
    for (const group of groups) {
      const node = nodes.get(group.id)!;
      const parent = group.parentId ? nodes.get(group.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    res.json({
      data: roots,
      pagination: { page: 1, pageSize: groups.length, total: groups.length, totalPages: 1 },
    });
    return;
  }
  await listResource(
    req,
    res,
    prisma.requirementGroup,
    where,
    { sequence: "asc" },
    { select },
  );
});
