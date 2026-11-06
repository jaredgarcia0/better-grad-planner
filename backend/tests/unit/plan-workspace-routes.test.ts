import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMocks, resetPrismaMocks } from "../support/prisma-mocks.js";
import { testIds } from "../support/test-ids.js";
import { programFixture, courseFixture, termFixture } from "../support/fixtures.js";

vi.mock("../../src/lib/prisma.js", () => ({ prisma: prismaMocks }));

import { app } from "../../src/app.js";
import { Prisma } from "../../generated/prisma/client.js";
import { planInclude } from "../../src/services/plan-workspace.service.js";

const planId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac";
const cookie = "bgp_session=valid-session";
const snapshot = () => ({
  name: "My plan", programId: testIds.program,
  programs: [{ programId: testIds.program, role: "MAJOR" }],
  startTerm: "fall-2026", endTerm: "spring-2027", notes: "",
  dashboardLayout: null,
  courses: [{ courseId: testIds.course, termKey: "fall-2026" }],
});
const save = (body: object = snapshot()) => request(app).put(`/api/plans/${planId}/workspace`).set("Cookie", cookie).send(body);

describe("authenticated workspace snapshots", () => {
  beforeEach(() => {
    resetPrismaMocks();
    prismaMocks.session.findUnique.mockResolvedValue({
      userId: testIds.user, user: { id: testIds.user, email: "student@byui.edu" },
      revokedAt: null, expiresAt: new Date("2099-01-01"),
    });
    prismaMocks.$transaction.mockImplementation(async (callback) => callback(prismaMocks));
    prismaMocks.degreePlan.findUnique.mockResolvedValue(null);
    prismaMocks.degreeProgram.findMany.mockResolvedValue([programFixture()]);
    prismaMocks.plannedCourse.findMany.mockResolvedValue([]);
    prismaMocks.degreePlan.findUniqueOrThrow.mockResolvedValue({
      id: planId, userId: testIds.user, ...snapshot(), program: programFixture(),
      courses: [{ id: "entry", courseId: testIds.course, termKey: "fall-2026", course: courseFixture(), term: null }],
    });
  });

  it("requires authentication and validates before starting a transaction", async () => {
    expect((await request(app).put(`/api/plans/${planId}/workspace`).send(snapshot())).status).toBe(401);
    expect((await save({ ...snapshot(), courses: [{ courseId: testIds.course, termKey: "invalid" }] })).status).toBe(400);
    expect((await request(app).put("/api/plans/invalid/workspace").set("Cookie", cookie).send(snapshot())).status).toBe(400);
    expect(prismaMocks.$transaction).not.toHaveBeenCalled();
  });

  it("creates a client-ID plan and ordered courses in one serializable transaction, returning the complete snapshot", async () => {
    const body = { ...snapshot(), courses: [...snapshot().courses, { courseId: testIds.secondCourse, termKey: "" }] };
    const response = await save(body);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: planId, programs: body.programs, startTerm: body.startTerm, endTerm: body.endTerm,
      dashboardLayout: null, program: { id: testIds.program, name: "Computer Science" },
      courses: [{ course: { id: testIds.course, code: "CS 101" }, termKey: "fall-2026", term: null }],
    });
    expect(prismaMocks.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(prismaMocks.degreePlan.create).toHaveBeenCalledWith({ data: {
      ...snapshot(), courses: undefined, id: planId, userId: testIds.user, dashboardLayout: Prisma.JsonNull,
    } });
    expect(prismaMocks.plannedCourse.createMany).toHaveBeenCalledWith({ data: body.courses.map((course, sequence) => ({ ...course, planId, sequence })) });
    expect(prismaMocks.degreePlan.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: planId }, include: planInclude });
  });

  it("returns 404 for an existing ID owned by another user, without writes or catalog queries", async () => {
    prismaMocks.degreePlan.findUnique.mockResolvedValue({ id: planId, userId: testIds.secondUser });
    expect((await save()).status).toBe(404);
    expect(prismaMocks.degreePlan.findUnique).toHaveBeenCalledWith({ where: { id: planId } });
    expect(prismaMocks.degreeProgram.findMany).not.toHaveBeenCalled();
    expect(prismaMocks.degreePlan.create).not.toHaveBeenCalled();
    expect(prismaMocks.degreePlan.update).not.toHaveBeenCalled();
    expect(prismaMocks.plannedCourse.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    [],
    [programFixture({ degreeType: "MINOR" })],
    [programFixture({ degreeType: "CERTIFICATE" })],
  ])("rejects missing or incompatible primary catalog programs before writes %#", async (...programs) => {
    prismaMocks.degreeProgram.findMany.mockResolvedValue(programs);
    expect((await save()).status).toBe(400);
    expect(prismaMocks.degreePlan.create).not.toHaveBeenCalled();
    expect(prismaMocks.plannedCourse.deleteMany).not.toHaveBeenCalled();
  });

  it("validates all additional program roles against catalog degree types", async () => {
    const body = { ...snapshot(), programs: [...snapshot().programs, { programId: testIds.secondCourse, role: "MINOR" }] };
    prismaMocks.degreeProgram.findMany.mockResolvedValue([programFixture(), programFixture({ id: testIds.secondCourse, degreeType: "CERTIFICATE" })]);
    expect((await save(body)).status).toBe(400);
    prismaMocks.degreeProgram.findMany.mockResolvedValue([programFixture(), programFixture({ id: testIds.secondCourse, degreeType: "MINOR" })]);
    expect((await save(body)).status).toBe(200);
    body.programs[1]!.role = "CERTIFICATE";
    prismaMocks.degreeProgram.findMany.mockResolvedValue([programFixture(), programFixture({ id: testIds.secondCourse, degreeType: "CERTIFICATE" })]);
    expect((await save(body)).status).toBe(200);
  });

  it("updates only retained course assignment/order and deletes only removed courses", async () => {
    prismaMocks.degreePlan.findUnique.mockResolvedValue({ id: planId, userId: testIds.user });
    prismaMocks.plannedCourse.findMany.mockResolvedValue([
      { id: "stable-entry", courseId: testIds.course, notes: "Keep this", termId: testIds.term, termKey: null, term: termFixture() },
      { id: "removed", courseId: testIds.secondCourse, termKey: "" },
    ]);
    expect((await save()).status).toBe(200);
    expect(prismaMocks.degreePlan.update).toHaveBeenCalledWith({ where: { id: planId, userId: testIds.user }, data: expect.objectContaining({ notes: "", dashboardLayout: Prisma.JsonNull }) });
    expect(prismaMocks.plannedCourse.deleteMany).toHaveBeenCalledWith({ where: { planId, courseId: { notIn: [testIds.course] } } });
    expect(prismaMocks.plannedCourse.update).toHaveBeenCalledWith({
      where: { planId_courseId: { planId, courseId: testIds.course } }, data: { sequence: 0, termKey: "fall-2026" },
    });
    expect(prismaMocks.plannedCourse.createMany).not.toHaveBeenCalled();
  });

  it.each(["spring-2027", ""])("clears stale legacy termId when the semester changes to %j", async (termKey) => {
    prismaMocks.plannedCourse.findMany.mockResolvedValue([{ courseId: testIds.course, termId: testIds.term, termKey: "fall-2026" }]);
    expect((await save({ ...snapshot(), courses: [{ courseId: testIds.course, termKey }] })).status).toBe(200);
    expect(prismaMocks.plannedCourse.update).toHaveBeenCalledWith(expect.objectContaining({ data: { sequence: 0, termKey, termId: null } }));
  });

  it("clears all courses on an empty snapshot and preserves an omitted requirementLayout", async () => {
    expect((await save({ ...snapshot(), courses: [] })).status).toBe(200);
    expect(prismaMocks.plannedCourse.deleteMany).toHaveBeenCalledWith({ where: { planId, courseId: { notIn: [] } } });
    expect(prismaMocks.plannedCourse.createMany).not.toHaveBeenCalled();
    expect(prismaMocks.degreePlan.create.mock.calls[0]![0].data).not.toHaveProperty("requirementLayout");
  });

  it("retries serialization conflicts and surfaces name collisions as 409", async () => {
    prismaMocks.$transaction.mockRejectedValueOnce({ code: "P2034" });
    expect((await save()).status).toBe(200);
    expect(prismaMocks.$transaction).toHaveBeenCalledTimes(2);
    prismaMocks.degreePlan.create.mockRejectedValueOnce({ code: "P2002" });
    expect((await save()).status).toBe(409);
    expect(prismaMocks.$transaction).toHaveBeenCalledTimes(3);
  });

  it("rolls back a failed course write and makes repeated saves idempotent while preserving metadata", async () => {
    // A transaction double with isolated state: only a successful callback commits.
    // This verifies all writes use tx, including failures AFTER plan/course updates.
    let stored: { plan: Record<string, any>; courses: Record<string, any>[] } = {
      plan: { id: planId, userId: testIds.user, ...snapshot(), name: "Before", requirementLayout: ["general", "major"] },
      courses: [
        { id: "stable-entry", planId, courseId: testIds.course, termKey: null, termId: testIds.term, term: termFixture(), notes: "Keep this", sequence: 0 },
        { id: "removed-entry", planId, courseId: testIds.term, termKey: "", notes: "Removed", sequence: 1 },
      ],
    };
    const before = structuredClone(stored);
    let failInsert = true;
    prismaMocks.$transaction.mockImplementation(async (callback) => {
      const draft = structuredClone(stored);
      const result = await callback({
        degreeProgram: { findMany: async () => [programFixture()] },
        degreePlan: {
          findUnique: async () => draft.plan,
          update: async ({ data }: any) => {
            Object.assign(draft.plan, data, { dashboardLayout: data.dashboardLayout === Prisma.JsonNull ? null : data.dashboardLayout });
            return draft.plan;
          },
          findUniqueOrThrow: async () => ({ ...draft.plan, program: programFixture(), courses: draft.courses.map((course) => ({ ...course, course: courseFixture({ id: course.courseId }) })) }),
        },
        plannedCourse: {
          findMany: async () => structuredClone(draft.courses),
          deleteMany: async ({ where }: any) => { draft.courses = draft.courses.filter((course) => where.courseId.notIn.includes(course.courseId)); },
          update: async ({ where, data }: any) => {
            const entry = draft.courses.find((course) => course.courseId === where.planId_courseId.courseId)!;
            Object.assign(entry, data);
            return entry;
          },
          createMany: async ({ data }: any) => {
            if (failInsert) throw { code: "P2003" };
            draft.courses.push(...data.map((course: any) => ({ ...course, id: `new-${course.courseId}`, notes: null, termId: null })));
          },
        },
      });
      stored = draft;
      return result;
    });
    const body = { ...snapshot(), notes: "Changed", courses: [...snapshot().courses, { courseId: testIds.secondCourse, termKey: "" }] };
    expect((await save(body)).status).toBe(400);
    expect(stored).toEqual(before);
    failInsert = false;
    expect((await save(body)).status).toBe(200);
    expect(stored.plan).toMatchObject({ name: "My plan", notes: "Changed", requirementLayout: ["general", "major"] });
    expect(stored.courses).toHaveLength(2);
    expect(stored.courses[0]).toMatchObject({ id: "stable-entry", notes: "Keep this", termId: testIds.term, termKey: "fall-2026" });
    const saved = structuredClone(stored);
    expect((await save(body)).status).toBe(200);
    expect(stored).toEqual(saved);
    expect(prismaMocks.degreePlan.update).not.toHaveBeenCalled();
    expect(prismaMocks.plannedCourse.update).not.toHaveBeenCalled();
  });

  it("returns program, course, termKey, and legacy term name/startDate in list and detail", async () => {
    const plan = { id: planId, ...snapshot(), program: programFixture(), courses: [{
      id: "legacy", course: courseFixture(), termKey: null, termId: testIds.term, term: termFixture(),
    }] };
    prismaMocks.degreePlan.findMany.mockResolvedValue([plan]);
    prismaMocks.degreePlan.count.mockResolvedValue(1);
    prismaMocks.degreePlan.findFirst.mockResolvedValue(plan);
    for (const path of ["/api/plans?page=2&pageSize=1", `/api/plans/${planId}`]) {
      const response = await request(app).get(path).set("Cookie", cookie);
      expect(response.status).toBe(200);
      const data = Array.isArray(response.body.data) ? response.body.data[0] : response.body.data;
      expect(data).toMatchObject({ programs: snapshot().programs, dashboardLayout: null,
        program: { id: testIds.program }, courses: [{ termKey: null, course: { id: testIds.course },
          term: { name: "Fall 2026", startDate: "2026-09-01T00:00:00.000Z" } }],
      });
    }
    expect(prismaMocks.degreePlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: planInclude, skip: 1, take: 1, where: { userId: testIds.user } }));
    expect(prismaMocks.degreePlan.findFirst).toHaveBeenCalledWith({ where: { id: planId, userId: testIds.user }, include: planInclude });
  });

  it("accepts dashboard null reset on legacy POST/PATCH, maps JsonNull, and preserves omission", async () => {
    prismaMocks.degreePlan.findFirst.mockResolvedValue({ id: planId });
    for (const method of ["post", "patch"] as const) {
      const path = method === "post" ? "/api/plans" : `/api/plans/${planId}`;
      const response = await request(app)[method](path).set("Cookie", cookie).send({ name: "Plan", programId: testIds.program, dashboardLayout: null });
      expect(response.status).toBe(method === "post" ? 201 : 200);
      const model = method === "post" ? prismaMocks.degreePlan.create : prismaMocks.degreePlan.update;
      expect(model.mock.lastCall![0].data.dashboardLayout).toBe(Prisma.JsonNull);
      expect((await request(app)[method](path).set("Cookie", cookie).send({ name: "Plan", programId: testIds.program })).status).toBe(method === "post" ? 201 : 200);
      expect(model.mock.lastCall![0].data).not.toHaveProperty("dashboardLayout");
      expect((await request(app)[method](path).set("Cookie", cookie).send({ name: "Plan", programId: testIds.program, dashboardLayout: { version: 1, rows: [{ id: "bad" }] } })).status).toBe(400);
    }
  });
});
