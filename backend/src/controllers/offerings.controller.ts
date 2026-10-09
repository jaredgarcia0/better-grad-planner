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

export const listOfferings = asyncHandler(async (req, res) => {
  const courseId = queryValue(req, "courseId");
  const termId = queryValue(req, "termId");
  await listResource(
    req,
    res,
    prisma.courseOffering,
    {
      ...(courseId ? { courseId } : {}),
      ...(termId ? { termId } : {}),
    },
    { termId: "asc" },
  );
});
export const getOffering = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.courseOffering),
);
export const createOffering = asyncHandler(async (req, res) =>
  createResource(req, res, prisma.courseOffering),
);
export const updateOffering = asyncHandler(async (req, res) =>
  updateResource(req, res, prisma.courseOffering),
);
export const deleteOffering = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.courseOffering),
);
