import { prisma } from "../lib/prisma.js";
import { DegreePlanStatus, type Prisma } from "../../generated/prisma/client.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/httpError.js";
import { pagination, response } from "../utils/parse.js";

async function ownedPlan(planId: string, userId: string) {
  const plan = await prisma.degreePlan.findFirst({ where: { id: planId, userId } });
  if (!plan) throw new HttpError(404, "The requested record was not found.");
  return plan;
}

async function ownedRecord<T extends { findFirst: (args: any) => Promise<any> }>(
  model: T,
  id: string,
  userId: string,
) {
  const record = await model.findFirst({ where: { id, userId } });
  if (!record) throw new HttpError(404, "The requested record was not found.");
  return record;
}

export const listDegreePlans = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const page = pagination(req.query as Record<string, unknown>);
  const status = req.query.status as DegreePlanStatus | undefined;
  const where: Prisma.DegreePlanWhereInput = {
    userId,
    ...(status ? { status } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.degreePlan.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        userId: true,
        programId: true,
        name: true,
        notes: true,
        requirementLayout: true,
        status: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.degreePlan.count({ where }),
  ]);
  res.json(response(data, page, total));
});

export const createDegreePlan = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const data = req.body as Prisma.DegreePlanUncheckedCreateInput;
  if (data.isDefault) {
    await prisma.degreePlan.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }
  const plan = await prisma.degreePlan.create({ data: { ...data, userId } });
  res.status(201).json({ data: plan });
});

export const getDegreePlan = asyncHandler(async (req, res) => {
  const plan = await ownedPlan(req.params.id as string, req.user!.id);
  res.json({ data: plan });
});

export const updateDegreePlan = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const plan = await ownedPlan(req.params.id as string, userId);
  const data = req.body as Prisma.DegreePlanUncheckedUpdateInput;
  if (data.isDefault) {
    await prisma.degreePlan.updateMany({
      where: { userId, isDefault: true, NOT: { id: plan.id } },
      data: { isDefault: false },
    });
  }
  const updated = await prisma.degreePlan.update({ where: { id: plan.id }, data });
  res.json({ data: updated });
});

export const deleteDegreePlan = asyncHandler(async (req, res) => {
  const plan = await ownedPlan(req.params.id as string, req.user!.id);
  await prisma.degreePlan.delete({ where: { id: plan.id } });
  res.status(204).send();
});

export const listPlannedCourses = asyncHandler(async (req, res) => {
  const planId = req.params.planId as string;
  await ownedPlan(planId, req.user!.id);
  const page = pagination(req.query as Record<string, unknown>);
  const where = {
    planId,
    ...(req.query.termId ? { termId: req.query.termId as string } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.plannedCourse.findMany({
      where,
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        planId: true,
        courseId: true,
        termId: true,
        sequence: true,
        notes: true,
      },
    }),
    prisma.plannedCourse.count({ where }),
  ]);
  res.json(response(data, page, total));
});

export const createPlannedCourse = asyncHandler(async (req, res) => {
  const planId = req.params.planId as string;
  await ownedPlan(planId, req.user!.id);
  const course = await prisma.plannedCourse.create({
    data: { ...(req.body as Prisma.PlannedCourseUncheckedCreateInput), planId },
  });
  res.status(201).json({ data: course });
});

export const getPlannedCourse = asyncHandler(async (req, res) => {
  const planId = req.params.planId as string;
  await ownedPlan(planId, req.user!.id);
  const course = await prisma.plannedCourse.findFirst({
    where: { id: req.params.courseEntryId as string, planId },
  });
  if (!course) throw new HttpError(404, "The requested record was not found.");
  res.json({ data: course });
});

export const updatePlannedCourse = asyncHandler(async (req, res) => {
  const planId = req.params.planId as string;
  await ownedPlan(planId, req.user!.id);
  const course = await prisma.plannedCourse.findFirst({
    where: { id: req.params.courseEntryId as string, planId },
  });
  if (!course) throw new HttpError(404, "The requested record was not found.");
  const updated = await prisma.plannedCourse.update({
    where: { id: course.id },
    data: req.body,
  });
  res.json({ data: updated });
});

export const deletePlannedCourse = asyncHandler(async (req, res) => {
  const planId = req.params.planId as string;
  await ownedPlan(planId, req.user!.id);
  const course = await prisma.plannedCourse.findFirst({
    where: { id: req.params.courseEntryId as string, planId },
  });
  if (!course) throw new HttpError(404, "The requested record was not found.");
  await prisma.plannedCourse.delete({ where: { id: course.id } });
  res.status(204).send();
});

export const listCompletedCourses = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const page = pagination(req.query as Record<string, unknown>);
  const where = { userId };
  const [data, total] = await Promise.all([
    prisma.completedCourse.findMany({
      where,
      orderBy: [{ completedOn: "desc" }, { createdAt: "desc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        userId: true,
        courseId: true,
        termId: true,
        grade: true,
        creditsEarned: true,
        completedOn: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.completedCourse.count({ where }),
  ]);
  res.json(response(data, page, total));
});

export const createCompletedCourse = asyncHandler(async (req, res) => {
  const course = await prisma.completedCourse.create({
    data: {
      ...(req.body as Prisma.CompletedCourseUncheckedCreateInput),
      userId: req.user!.id,
    },
  });
  res.status(201).json({ data: course });
});

export const getCompletedCourse = asyncHandler(async (req, res) => {
  const course = await ownedRecord(prisma.completedCourse, req.params.id as string, req.user!.id);
  res.json({ data: course });
});

export const updateCompletedCourse = asyncHandler(async (req, res) => {
  const course = await ownedRecord(prisma.completedCourse, req.params.id as string, req.user!.id);
  const updated = await prisma.completedCourse.update({ where: { id: course.id }, data: req.body });
  res.json({ data: updated });
});

export const deleteCompletedCourse = asyncHandler(async (req, res) => {
  const course = await ownedRecord(prisma.completedCourse, req.params.id as string, req.user!.id);
  await prisma.completedCourse.delete({ where: { id: course.id } });
  res.status(204).send();
});

export const listTransferCourses = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const page = pagination(req.query as Record<string, unknown>);
  const where = { userId };
  const [data, total] = await Promise.all([
    prisma.transferCourse.findMany({
      where,
      orderBy: [{ completedOn: "desc" }, { createdAt: "desc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        userId: true,
        courseId: true,
        grade: true,
        transferSource: true,
        creditsEarned: true,
        completedOn: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.transferCourse.count({ where }),
  ]);
  res.json(response(data, page, total));
});

export const createTransferCourse = asyncHandler(async (req, res) => {
  const course = await prisma.transferCourse.create({
    data: {
      ...(req.body as Prisma.TransferCourseUncheckedCreateInput),
      userId: req.user!.id,
    },
  });
  res.status(201).json({ data: course });
});

export const getTransferCourse = asyncHandler(async (req, res) => {
  const course = await ownedRecord(prisma.transferCourse, req.params.id as string, req.user!.id);
  res.json({ data: course });
});

export const updateTransferCourse = asyncHandler(async (req, res) => {
  const course = await ownedRecord(prisma.transferCourse, req.params.id as string, req.user!.id);
  const updated = await prisma.transferCourse.update({ where: { id: course.id }, data: req.body });
  res.json({ data: updated });
});

export const deleteTransferCourse = asyncHandler(async (req, res) => {
  const course = await ownedRecord(prisma.transferCourse, req.params.id as string, req.user!.id);
  await prisma.transferCourse.delete({ where: { id: course.id } });
  res.status(204).send();
});
