import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  });

  return {
    course: model(),
    coursePrerequisite: model(),
    courseOffering: model(),
    university: model(),
    department: model(),
    degreeProgram: model(),
    requirementGroup: model(),
    requirementCourse: model(),
    academicTerm: model(),
  };
});

vi.mock("./lib/prisma.js", () => ({ prisma: prismaMocks }));

import { app } from "./app.js";

describe("API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
