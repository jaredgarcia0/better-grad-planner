import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMocks, resetPrismaMocks } from "../support/prisma-mocks.js";
import { testIds } from "../support/test-ids.js";

vi.mock("../../src/lib/prisma.js", () => ({ prisma: prismaMocks }));

import { app } from "../../src/app.js";

const authCookie = "bgp_session=valid-session";
const planId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac";
const entryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad";

describe("student record routes", () => {
  beforeEach(() => {
    resetPrismaMocks();
    prismaMocks.session.findUnique.mockResolvedValue({
      userId: testIds.user,
      user: { id: testIds.user, email: "student@byui.edu" },
      revokedAt: null,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
  });

  it("requires authentication before listing plans", async () => {
    const response = await request(app).get("/api/plans");

    expect(response.status).toBe(401);
    expect(prismaMocks.degreePlan.findMany).not.toHaveBeenCalled();
  });

  it("creates a validated user-owned degree plan", async () => {
    const plan = { id: planId, userId: testIds.user, name: "Computer Science" };
    prismaMocks.degreePlan.create.mockResolvedValue(plan);

    const response = await request(app)
      .post("/api/plans")
      .set("Cookie", authCookie)
      .send({ programId: testIds.program, name: " Computer Science ", isDefault: true });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: plan });
    expect(prismaMocks.degreePlan.updateMany).toHaveBeenCalledWith({
      where: { userId: testIds.user, isDefault: true },
      data: { isDefault: false },
    });
    expect(prismaMocks.degreePlan.create).toHaveBeenCalledWith({
      data: {
        userId: testIds.user,
        programId: testIds.program,
        name: "Computer Science",
        status: "DRAFT",
        isDefault: true,
      },
    });
  });

  it("does not expose a plan that belongs to another user", async () => {
    prismaMocks.degreePlan.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .get(`/api/plans/${planId}`)
      .set("Cookie", authCookie);

    expect(response.status).toBe(404);
    expect(prismaMocks.degreePlan.findFirst).toHaveBeenCalledWith({
      where: { id: planId, userId: testIds.user },
    });
  });

  it("adds a planned course only after verifying ownership of its plan", async () => {
    prismaMocks.degreePlan.findFirst.mockResolvedValue({ id: planId, userId: testIds.user });
    const plannedCourse = { id: entryId, planId, courseId: testIds.course, sequence: 0 };
    prismaMocks.plannedCourse.create.mockResolvedValue(plannedCourse);

    const response = await request(app)
      .post(`/api/plans/${planId}/courses`)
      .set("Cookie", authCookie)
      .send({ courseId: testIds.course });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: plannedCourse });
    expect(prismaMocks.plannedCourse.create).toHaveBeenCalledWith({
      data: { planId, courseId: testIds.course, sequence: 0 },
    });
  });

  it("validates planned-course identifiers before database access", async () => {
    const response = await request(app)
      .post(`/api/plans/${planId}/courses`)
      .set("Cookie", authCookie)
      .send({ courseId: "invalid" });

    expect(response.status).toBe(400);
    expect(prismaMocks.degreePlan.findFirst).not.toHaveBeenCalled();
  });

  it("creates a completed course for the authenticated user", async () => {
    const completed = { id: entryId, userId: testIds.user, courseId: testIds.course };
    prismaMocks.completedCourse.create.mockResolvedValue(completed);

    const response = await request(app)
      .post("/api/completed-courses")
      .set("Cookie", authCookie)
      .send({ courseId: testIds.course, creditsEarned: 3, completedOn: "2026-04-20" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: completed });
    expect(prismaMocks.completedCourse.create).toHaveBeenCalledWith({
      data: {
        userId: testIds.user,
        courseId: testIds.course,
        creditsEarned: 3,
        completedOn: new Date("2026-04-20"),
      },
    });
  });

  it("creates a transfer course for the authenticated user", async () => {
    const transfer = { id: entryId, userId: testIds.user, courseId: testIds.course };
    prismaMocks.transferCourse.create.mockResolvedValue(transfer);

    const response = await request(app)
      .post("/api/transfer-courses")
      .set("Cookie", authCookie)
      .send({ courseId: testIds.course, transferSource: "Community College" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: transfer });
    expect(prismaMocks.transferCourse.create).toHaveBeenCalledWith({
      data: {
        userId: testIds.user,
        courseId: testIds.course,
        transferSource: "Community College",
      },
    });
  });
});
