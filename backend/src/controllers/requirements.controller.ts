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

export const listRequirements = asyncHandler(async (req, res) => {
  const programId = queryValue(req, "programId");
  const parentId = queryValue(req, "parentId");
  await listResource(
    req,
    res,
    prisma.requirementGroup,
    {
      ...(programId ? { programId } : {}),
      ...(parentId ? { parentId } : {}),
      ...(req.query.requirementType
        ? { requirementType: req.query.requirementType }
        : {}),
      ...(req.query.operator ? { operator: req.query.operator } : {}),
    },
    { sequence: "asc" },
  );
});
export const getRequirement = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.requirementGroup),
);
export const createRequirement = asyncHandler(async (req, res) =>
  createResource(req, res, prisma.requirementGroup),
);
export const updateRequirement = asyncHandler(async (req, res) =>
  updateResource(req, res, prisma.requirementGroup),
);
export const deleteRequirement = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.requirementGroup),
);

export const listRequirementCourses = asyncHandler(async (req, res) => {
  await listResource(
    req,
    res,
    prisma.requirementCourse,
    { requirementId: idFrom(req) },
    { sequence: "asc" },
  );
});
