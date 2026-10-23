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

export const listTerms = asyncHandler(async (req, res) => {
  const search = queryValue(req, "q");
  const universityId = queryValue(req, "universityId");
  await listResource(
    req,
    res,
    prisma.academicTerm,
    {
      ...(universityId ? { universityId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    { startsOn: "asc" },
    {
      select: {
        id: true,
        universityId: true,
        name: true,
        code: true,
        startsOn: true,
        endsOn: true,
      },
    },
  );
});
export const getTerm = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.academicTerm),
);
export const createTerm = asyncHandler(async (req, res) =>
  createResource(req, res, prisma.academicTerm),
);
export const updateTerm = asyncHandler(async (req, res) =>
  updateResource(req, res, prisma.academicTerm),
);
export const deleteTerm = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.academicTerm),
);
export const listTermOfferings = asyncHandler(async (req, res) =>
  listResource(
    req,
    res,
    prisma.courseOffering,
    { termId: idFrom(req) },
    { courseId: "asc" },
    {
      select: {
        id: true,
        courseId: true,
        termId: true,
        sectionCode: true,
        instructor: true,
        meetingInfo: true,
        capacity: true,
        seatsOpen: true,
      },
    },
  ),
);
