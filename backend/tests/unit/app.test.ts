import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMocks, resetPrismaMocks } from "../support/prisma-mocks.js";

vi.mock("../../src/lib/prisma.js", () => ({ prisma: prismaMocks }));

import { app } from "../../src/app.js";

describe("API", () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it("returns a healthy status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns a 404 for an unknown route", async () => {
    const response = await request(app).get("/unknown");

    expect(response.status).toBe(404);
    expect(response.body.error).toContain("Route not found");
  });

  it("validates path UUIDs before accessing Prisma", async () => {
    const response = await request(app).get("/api/courses/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("params validation failed");
    expect(prismaMocks.course.findUnique).not.toHaveBeenCalled();
  });

  it("rejects invalid pagination and reports query validation errors", async () => {
    const response = await request(app).get("/api/courses?page=0&pageSize=101");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("query validation failed");
    expect(response.body.details).toBeDefined();
    expect(prismaMocks.course.findMany).not.toHaveBeenCalled();
  });

  it("lists courses with validated filters and pagination", async () => {
    const course = { id: "course-1", code: "CS 101", title: "Intro to CS" };
    prismaMocks.course.findMany.mockResolvedValue([course]);
    prismaMocks.course.count.mockResolvedValue(21);

    const response = await request(app)
      .get("/api/courses?q=%20computer%20&active=false&page=2&pageSize=10");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [course],
      pagination: { page: 2, pageSize: 10, total: 21, totalPages: 3 },
    });
    expect(prismaMocks.course.findMany).toHaveBeenCalledWith({
      where: {
        active: false,
        OR: [
          { code: { contains: "computer", mode: "insensitive" } },
          { title: { contains: "computer", mode: "insensitive" } },
        ],
      },
      orderBy: { code: "asc" },
      skip: 10,
      take: 10,
    });
    expect(prismaMocks.course.count).toHaveBeenCalledWith({
      where: {
        active: false,
        OR: [
          { code: { contains: "computer", mode: "insensitive" } },
          { title: { contains: "computer", mode: "insensitive" } },
        ],
      },
    });
  });

  it("applies defaults and trims strings when creating a course", async () => {
    const createdCourse = { id: "course-1", code: "CS 101", title: "Intro to CS", active: true };
    prismaMocks.course.create.mockResolvedValue(createdCourse);

    const response = await request(app).post("/api/courses").send({
      universityId: "123e4567-e89b-42d3-a456-426614174000",
      code: " CS 101 ",
      title: " Intro to CS ",
      credits: "3",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: createdCourse });
    expect(prismaMocks.course.create).toHaveBeenCalledWith({
      data: {
        universityId: "123e4567-e89b-42d3-a456-426614174000",
        code: "CS 101",
        title: "Intro to CS",
        credits: 3,
        active: true,
      },
    });
  });

  it("rejects invalid create bodies", async () => {
    const response = await request(app).post("/api/courses").send({
      universityId: "bad-id",
      code: "   ",
      title: "Course",
      credits: "three",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("body validation failed");
    expect(prismaMocks.course.create).not.toHaveBeenCalled();
  });

  it("returns 404 when a requested course is absent", async () => {
    prismaMocks.course.findUnique.mockResolvedValue(null);

    const response = await request(app).get("/api/courses/123e4567-e89b-42d3-a456-426614174000");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "The requested record was not found." });
  });

  it("rejects empty updates before writing", async () => {
    const response = await request(app)
      .patch("/api/courses/123e4567-e89b-42d3-a456-426614174000")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("At least one field");
    expect(prismaMocks.course.update).not.toHaveBeenCalled();
  });

  it("maps Prisma unique constraint errors to conflict responses", async () => {
    prismaMocks.course.create.mockRejectedValue({ code: "P2002" });

    const response = await request(app).post("/api/courses").send({
      universityId: "123e4567-e89b-42d3-a456-426614174000",
      code: "CS 101",
      title: "Intro to CS",
      credits: 3,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "A record with those unique values already exists.",
    });
  });

  it.each([
    ["/api/departments?universityId=bad-id", prismaMocks.department.findMany],
    ["/api/programs?universityId=bad-id", prismaMocks.degreeProgram.findMany],
    ["/api/requirements?programId=bad-id", prismaMocks.requirementGroup.findMany],
    ["/api/courses?universityId=bad-id", prismaMocks.course.findMany],
    ["/api/requirement-courses?courseId=bad-id", prismaMocks.requirementCourse.findMany],
    ["/api/prerequisites?courseId=bad-id", prismaMocks.coursePrerequisite.findMany],
    ["/api/terms?universityId=bad-id", prismaMocks.academicTerm.findMany],
    ["/api/offerings?courseId=bad-id", prismaMocks.courseOffering.findMany],
  ])("rejects invalid UUID query filters before Prisma access: %s", async (url, model) => {
    const response = await request(app).get(url);
    expect(response.status).toBe(400);
    expect(model).not.toHaveBeenCalled();
  });

  it.each([
    ["/api/programs?degreeType=INVALID", prismaMocks.degreeProgram.findMany],
    ["/api/requirements?requirementType=INVALID", prismaMocks.requirementGroup.findMany],
    ["/api/requirements?operator=INVALID", prismaMocks.requirementGroup.findMany],
    ["/api/prerequisites?type=INVALID", prismaMocks.coursePrerequisite.findMany],
    ["/api/courses?level=INVALID", prismaMocks.course.findMany],
  ])("rejects invalid enum query filters before Prisma access: %s", async (url, model) => {
    const response = await request(app).get(url);
    expect(response.status).toBe(400);
    expect(model).not.toHaveBeenCalled();
  });

  it("accepts every catalog enum value", async () => {
    const cases = [
      ["/api/programs?degreeType=", ["ASSOCIATE", "BACHELOR", "MASTER", "DOCTORATE", "CERTIFICATE", "OTHER"], prismaMocks.degreeProgram],
      ["/api/requirements?requirementType=", ["REQUIRED", "ELECTIVE", "CONCENTRATION", "GENERAL_EDUCATION", "CAPSTONE", "OTHER"], prismaMocks.requirementGroup],
      ["/api/requirements?operator=", ["ALL", "ANY"], prismaMocks.requirementGroup],
      ["/api/prerequisites?type=", ["PREREQUISITE", "COREQUISITE"], prismaMocks.coursePrerequisite],
      ["/api/courses?level=", ["INTRODUCTORY", "INTERMEDIATE", "ADVANCED", "GRADUATE"], prismaMocks.course],
    ] as const;

    for (const [prefix, values, model] of cases) {
      model.findMany.mockResolvedValue([]);
      model.count.mockResolvedValue(0);
      for (const value of values) {
        const response = await request(app).get(`${prefix}${value}`);
        expect(response.status).toBe(200);
      }
    }
  });

  it("applies request defaults and strips unknown properties before writing", async () => {
    prismaMocks.requirementGroup.create.mockResolvedValue({ id: "requirement-1" });
    const requirementResponse = await request(app).post("/api/requirements").send({
      programId: "123e4567-e89b-42d3-a456-426614174000",
      name: " Core ",
      requirementType: "REQUIRED",
      unknown: "removed",
    });
    expect(requirementResponse.status).toBe(201);
    expect(prismaMocks.requirementGroup.create).toHaveBeenCalledWith({ data: {
      programId: "123e4567-e89b-42d3-a456-426614174000",
      name: "Core",
      requirementType: "REQUIRED",
      operator: "ALL",
      sequence: 0,
    } });
    expect(prismaMocks.requirementGroup.create.mock.calls[0][0].data).not.toHaveProperty("unknown");

    prismaMocks.coursePrerequisite.create.mockResolvedValue({ id: "prerequisite-1" });
    await request(app).post("/api/prerequisites").send({
      courseId: "123e4567-e89b-42d3-a456-426614174000",
      prerequisiteCourseId: "123e4567-e89b-42d3-a456-426614174001",
    });
    expect(prismaMocks.coursePrerequisite.create).toHaveBeenCalledWith({ data: {
      courseId: "123e4567-e89b-42d3-a456-426614174000",
      prerequisiteCourseId: "123e4567-e89b-42d3-a456-426614174001",
      type: "PREREQUISITE",
      groupNumber: 0,
      isAlternative: false,
    } });
  });

  it("applies sequence defaults and supports valid partial updates", async () => {
    prismaMocks.requirementCourse.create.mockResolvedValue({ id: "link-1" });
    await request(app).post("/api/requirement-courses").send({
      requirementId: "123e4567-e89b-42d3-a456-426614174000",
      courseId: "123e4567-e89b-42d3-a456-426614174001",
    });
    expect(prismaMocks.requirementCourse.create).toHaveBeenCalledWith({ data: {
      requirementId: "123e4567-e89b-42d3-a456-426614174000",
      courseId: "123e4567-e89b-42d3-a456-426614174001",
      sequence: 0,
    } });

    prismaMocks.course.update.mockResolvedValue({ id: "course-1", title: "Updated" });
    const response = await request(app)
      .patch("/api/courses/123e4567-e89b-42d3-a456-426614174000")
      .send({ title: " Updated " });
    expect(response.status).toBe(200);
    expect(prismaMocks.course.update).toHaveBeenCalledWith({
      where: { id: "123e4567-e89b-42d3-a456-426614174000" },
      data: { title: "Updated", active: true },
    });
  });

  it("rejects invalid dates through the HTTP boundary before Prisma access", async () => {
    const response = await request(app).post("/api/terms").send({
      universityId: "123e4567-e89b-42d3-a456-426614174000",
      name: "Fall 2026",
      code: "FALL-26",
      startsOn: "not-a-date",
      endsOn: "2026-12-20",
    });
    expect(response.status).toBe(400);
    expect(prismaMocks.academicTerm.create).not.toHaveBeenCalled();
  });

  it("maps route-level async and Prisma errors and returns an exact 204 response", async () => {
    prismaMocks.course.findUnique.mockRejectedValue(new Error("database unavailable"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const genericError = await request(app).get("/api/courses/123e4567-e89b-42d3-a456-426614174000");
    expect(genericError.status).toBe(500);
    expect(genericError.body).toEqual({ error: "Internal server error." });
    errorSpy.mockRestore();

    prismaMocks.course.findUnique.mockRejectedValue({ code: "P2025" });
    expect((await request(app).get("/api/courses/123e4567-e89b-42d3-a456-426614174000")).body).toEqual({
      error: "The requested record was not found.",
    });

    prismaMocks.course.delete.mockRejectedValue({ code: "P2003" });
    expect((await request(app).delete("/api/courses/123e4567-e89b-42d3-a456-426614174000")).body).toEqual({
      error: "A referenced record does not exist.",
    });

    prismaMocks.course.delete.mockResolvedValue({});
    const deleted = await request(app).delete("/api/courses/123e4567-e89b-42d3-a456-426614174000");
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");
  });
});
