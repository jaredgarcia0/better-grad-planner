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

export const listPrerequisites = asyncHandler(async (req, res) => {
  const courseId = queryValue(req, "courseId");
  const prerequisiteCourseId = queryValue(req, "prerequisiteCourseId");
  await listResource(
    req,
    res,
    prisma.coursePrerequisite,
    {
      ...(courseId ? { courseId } : {}),
      ...(prerequisiteCourseId ? { prerequisiteCourseId } : {}),
      ...(req.query.type ? { type: req.query.type } : {}),
    },
    { groupNumber: "asc" },
  );
});
export const getPrerequisite = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.coursePrerequisite),
);
export const createPrerequisite = asyncHandler(async (req, res) =>
  createResource(req, res, prisma.coursePrerequisite),
);
export const updatePrerequisite = asyncHandler(async (req, res) =>
  updateResource(req, res, prisma.coursePrerequisite),
);
export const deletePrerequisite = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.coursePrerequisite),
);
