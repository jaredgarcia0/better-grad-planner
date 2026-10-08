import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createResource,
  deleteResource,
  getResource,
  listResource,
  queryValue,
  updateResource,
} from "./common.controller.js";

export const listRequirementCourseLinks = asyncHandler(async (req, res) => {
  const requirementId = queryValue(req, "requirementId");
  const courseId = queryValue(req, "courseId");
  await listResource(
    req,
    res,
    prisma.requirementCourse,
    {
      ...(requirementId ? { requirementId } : {}),
      ...(courseId ? { courseId } : {}),
    },
    { sequence: "asc" },
  );
});
export const getRequirementCourseLink = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.requirementCourse),
);
export const createRequirementCourseLink = asyncHandler(async (req, res) =>
  createResource(req, res, prisma.requirementCourse),
);
export const updateRequirementCourseLink = asyncHandler(async (req, res) =>
  updateResource(req, res, prisma.requirementCourse),
);
export const deleteRequirementCourseLink = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.requirementCourse),
);
