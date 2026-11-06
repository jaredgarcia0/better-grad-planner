import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { PlanWorkspace } from "../schemas/plan-workspace.schemas.js";
import { HttpError } from "../utils/httpError.js";

export const planInclude = {
  program: true,
  courses: {
    orderBy: [{ sequence: "asc" }, { id: "asc" }],
    include: { course: true, term: true },
  },
} satisfies Prisma.DegreePlanInclude;

/** Preserve the legacy term fields and expose the frontend's date alias. */
export function workspaceResponse<T extends { courses?: { term?: { startsOn: Date } | null }[] }>(plan: T) {
  return {
    ...plan,
    ...(plan.courses ? {
      courses: plan.courses.map((entry) => ({
        ...entry,
        term: entry.term ? { ...entry.term, startDate: entry.term.startsOn } : null,
      })),
    } : {}),
  };
}

function legacyTermKey(name: string | undefined) {
  const match = name?.match(/\b(fall|winter|spring)\s+(\d{4})\b/i);
  return match ? `${match[1]!.toLowerCase()}-${match[2]}` : "";
}

export async function savePlanWorkspace(id: string, userId: string, snapshot: PlanWorkspace) {
  // Serializable isolation prevents concurrent replacements from mixing courses.
  // Retry PostgreSQL serialization conflicts; never retry validation/uniqueness errors.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Look up by ID alone: a plan owned by someone else is NOT a create candidate.
        const existing = await tx.degreePlan.findUnique({ where: { id } });
        if (existing && existing.userId !== userId) {
          throw new HttpError(404, "The requested record was not found.");
        }

        const catalogPrograms = await tx.degreeProgram.findMany({
          where: { id: { in: snapshot.programs.map((program) => program.programId) } },
          select: { id: true, degreeType: true },
        });
        const degreeTypes = new Map(catalogPrograms.map((program) => [program.id.toLowerCase(), program.degreeType]));
        for (const program of snapshot.programs) {
          const degreeType = degreeTypes.get(program.programId.toLowerCase());
          if (!degreeType) throw new HttpError(400, "A referenced program does not exist.");
          const validRole = program.role === "MAJOR"
            ? ["ASSOCIATE", "BACHELOR", "MASTER", "DOCTORATE"].includes(degreeType)
            : degreeType === program.role;
          if (!validRole) throw new HttpError(400, "Program role does not match its catalog degree type.");
        }

        const { courses, dashboardLayout, ...fields } = snapshot;
        const data = { ...fields, dashboardLayout: dashboardLayout === null ? Prisma.JsonNull : dashboardLayout };
        if (existing) {
          await tx.degreePlan.update({ where: { id, userId }, data });
        } else {
          await tx.degreePlan.create({ data: { ...data, id, userId } });
        }
        const previousCourses = await tx.plannedCourse.findMany({
          where: { planId: id },
          include: { term: true },
        });
        const previousById = new Map(previousCourses.map((course) => [course.courseId.toLowerCase(), course]));
        await tx.plannedCourse.deleteMany({
          where: { planId: id, courseId: { notIn: courses.map((course) => course.courseId) } },
        });
        const additions: Prisma.PlannedCourseCreateManyInput[] = [];
        for (const [sequence, course] of courses.entries()) {
          const previous = previousById.get(course.courseId.toLowerCase());
          if (previous) {
            const previousTermKey = previous.termKey ?? legacyTermKey(previous.term?.name);
            await tx.plannedCourse.update({
              where: { planId_courseId: { planId: id, courseId: course.courseId } },
              data: {
                sequence,
                termKey: course.termKey,
                ...(previousTermKey !== course.termKey ? { termId: null } : {}),
              },
            });
          } else {
            additions.push({ ...course, planId: id, sequence });
          }
        }
        if (additions.length) {
          await tx.plannedCourse.createMany({
            data: additions,
          });
        }
        // Read inside the same transaction so the response matches the committed snapshot.
        const plan = await tx.degreePlan.findUniqueOrThrow({ where: { id }, include: planInclude });
        return workspaceResponse(plan);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt < 2 && typeof error === "object" && error !== null && "code" in error && error.code === "P2034") continue;
      throw error;
    }
  }
}
