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

export const listPrograms = asyncHandler(async (req, res) => {
  const search = queryValue(req, "q");
  const universityId = queryValue(req, "universityId");
  await listResource(req, res, prisma.degreeProgram, {
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
  });
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

export const listProgramRequirements = asyncHandler(async (req, res) => {
  const search = queryValue(req, "q");
  await listResource(
    req,
    res,
    prisma.requirementGroup,
    {
      programId: idFrom(req),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    { sequence: "asc" },
  );
});
