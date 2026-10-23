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

export const listCourses = asyncHandler(async (req, res) => {
  const search = queryValue(req, "q");
  const universityId = queryValue(req, "universityId");
  const departmentId = queryValue(req, "departmentId");
  await listResource(
    req,
    res,
    prisma.course,
    {
      ...(universityId ? { universityId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(req.query.level ? { level: req.query.level } : {}),
      ...(req.query.active !== undefined ? { active: req.query.active } : {}),
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
    {
      select: {
        id: true,
        universityId: true,
        departmentId: true,
        code: true,
        title: true,
        credits: true,
        level: true,
        active: true,
        department: { select: { code: true, name: true } },
      },
    },
  );
});
export const getCourse = asyncHandler(async (req, res) =>
  getResource(req, res, prisma.course),
);
export const createCourse = asyncHandler(async (req, res) =>
  createResource(req, res, prisma.course),
);
export const updateCourse = asyncHandler(async (req, res) =>
  updateResource(req, res, prisma.course),
);
export const deleteCourse = asyncHandler(async (req, res) =>
  deleteResource(req, res, prisma.course),
);
export const listCoursePrerequisites = asyncHandler(async (req, res) =>
  listResource(
    req,
    res,
    prisma.coursePrerequisite,
    { courseId: idFrom(req) },
    { groupNumber: "asc" },
    {
      select: {
        id: true,
        courseId: true,
        prerequisiteCourseId: true,
        type: true,
        groupNumber: true,
        isAlternative: true,
        minimumGrade: true,
      },
    },
  ),
);
export const listCourseOfferings = asyncHandler(async (req, res) =>
  listResource(
    req,
    res,
    prisma.courseOffering,
    { courseId: idFrom(req) },
    { termId: "asc" },
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
