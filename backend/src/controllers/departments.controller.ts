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

export const listDepartments = asyncHandler(async (req, res) => {
  const search = queryValue(req, "q");
  const universityId = queryValue(req, "universityId");
  await listResource(req, res, prisma.department, {
    ...(universityId ? { universityId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  });
});
export const getDepartment = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.department),
);
export const createDepartment = asyncHandler(async (req, res) =>
  createResource(req, res, prisma.department),
);
export const updateDepartment = asyncHandler(async (req, res) =>
  updateResource(req, res, prisma.department),
);
export const deleteDepartment = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.department),
);
