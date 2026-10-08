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

export const listUniversities = asyncHandler(async (req, res) => {
  const search = queryValue(req, "q");
  await listResource(
    req,
    res,
    prisma.university,
    search ? { name: { contains: search, mode: "insensitive" } } : {},
  );
});
export const getUniversity = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.university),
);
export const createUniversity = asyncHandler(async (req, res) =>
  createResource(req, res, prisma.university),
);
export const updateUniversity = asyncHandler(async (req, res) =>
  updateResource(req, res, prisma.university),
);
export const deleteUniversity = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.university),
);

export const listUniversityDepartments = asyncHandler(async (req, res) => {
  const universityId = idFrom(req);
  const search = queryValue(req, "q");
  await listResource(req, res, prisma.department, {
    universityId,
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

export const listUniversityPrograms = asyncHandler(async (req, res) => {
  const universityId = idFrom(req);
  const search = queryValue(req, "q");
  await listResource(req, res, prisma.degreeProgram, {
    universityId,
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

export const listUniversityCourses = asyncHandler(async (req, res) => {
  const universityId = idFrom(req);
  const search = queryValue(req, "q");
  await listResource(
    req,
    res,
    prisma.course,
    {
      universityId,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    { code: "asc" },
  );
});
