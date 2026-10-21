import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMocks, resetPrismaMocks } from "../support/prisma-mocks.js";
import { userFixture } from "../support/fixtures.js";
import { testIds } from "../support/test-ids.js";

vi.mock("../../src/lib/prisma.js", () => ({ prisma: prismaMocks }));
vi.mock("../../src/services/email.js", () => ({ sendAuthCode: vi.fn() }));

import { authRouter } from "../../src/routes/auth.routes.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { hashPassword, hashToken } from "../../src/utils/auth.js";
import { sendAuthCode } from "../../src/services/email.js";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);
app.use(errorHandler);

const password = "a sufficiently long password";

describe("authentication routes", () => {
  beforeEach(() => {
    resetPrismaMocks();
  });

  it("registers a new user, replaces pending verification codes, and sends a code", async () => {
    const user = userFixture({ emailVerifiedAt: null });
    prismaMocks.user.findUnique.mockResolvedValue(null);
    prismaMocks.user.create.mockResolvedValue(user);

    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: " Student@BYUI.edu ", password });

    expect(response.status).toBe(201);
    expect(prismaMocks.user.create).toHaveBeenCalledWith({
      data: { email: "student@byui.edu", passwordHash: expect.any(String) },
    });
    expect(prismaMocks.emailVerificationCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id, usedAt: null },
    });
    expect(prismaMocks.emailVerificationCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: user.id, codeHash: expect.any(String) }),
    });
    expect(sendAuthCode).toHaveBeenCalledWith(user.email, expect.stringMatching(/^\d{8}$/), "email verification");
  });

  it("updates an unverified account and rejects an existing verified account", async () => {
    const unverified = userFixture({ emailVerifiedAt: null });
    prismaMocks.user.findUnique.mockResolvedValueOnce(unverified);
    prismaMocks.user.update.mockResolvedValue(unverified);
    let response = await request(app).post("/api/auth/register").send({ email: unverified.email, password });
    expect(response.status).toBe(200);
    expect(prismaMocks.user.update).toHaveBeenCalledWith({
      where: { id: unverified.id },
      data: { passwordHash: expect.any(String) },
    });

    prismaMocks.user.findUnique.mockResolvedValueOnce(userFixture());
    response = await request(app).post("/api/auth/register").send({ email: "other@byui.edu", password });
    expect(response.status).toBe(409);
  });

  it("rejects non-BYU-I registrations and invalid verification attempts", async () => {
    let response = await request(app).post("/api/auth/register").send({ email: "student@example.com", password });
    expect(response.status).toBe(400);

    prismaMocks.user.findUnique.mockResolvedValue(null);
    response = await request(app).post("/api/auth/verify-email").send({ email: "missing@byui.edu", code: "12345678" });
    expect(response.status).toBe(400);

    const user = userFixture();
    prismaMocks.user.findUnique.mockResolvedValue(user);
    prismaMocks.emailVerificationCode.findFirst.mockResolvedValue({ id: "code", attempts: 5 });
    response = await request(app).post("/api/auth/verify-email").send({ email: user.email, code: "12345678" });
    expect(response.status).toBe(400);
  });

  it("verifies a matching code, creates a session, and returns a public user", async () => {
    const user = userFixture({ emailVerifiedAt: null });
    prismaMocks.user.findUnique.mockResolvedValue(user);
    prismaMocks.emailVerificationCode.findFirst.mockResolvedValue({
      id: "code",
      attempts: 0,
      codeHash: hashToken("12345678"),
    });
    const verified = userFixture({ emailVerifiedAt: new Date("2026-02-01T00:00:00.000Z") });
    prismaMocks.user.update.mockResolvedValue(verified);

    const response = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: user.email, code: "12345678" });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ id: user.id, email: user.email, emailVerifiedAt: verified.emailVerifiedAt.toISOString() });
    expect(prismaMocks.emailVerificationCode.update).toHaveBeenCalledWith({
      where: { id: "code" },
      data: { attempts: { increment: 1 } },
    });
    expect(prismaMocks.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: user.id, tokenHash: expect.any(String) }),
    });
    expect(response.headers["set-cookie"][0]).toContain("bgp_session=");
  });

  it("rejects a verification code that does not match after recording the attempt", async () => {
    const user = userFixture();
    prismaMocks.user.findUnique.mockResolvedValue(user);
    prismaMocks.emailVerificationCode.findFirst.mockResolvedValue({
      id: "code",
      attempts: 0,
      codeHash: hashToken("87654321"),
    });

    const response = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: user.email, code: "12345678" });

    expect(response.status).toBe(400);
    expect(prismaMocks.emailVerificationCode.update).toHaveBeenCalledWith({
      where: { id: "code" },
      data: { attempts: { increment: 1 } },
    });
  });

  it("handles invalid, unverified, and valid login attempts", async () => {
    let response = await request(app).post("/api/auth/login").send({ email: "missing@byui.edu", password });
    expect(response.status).toBe(401);

    const passwordHash = await hashPassword(password);
    prismaMocks.user.findUnique.mockResolvedValue(userFixture({ passwordHash, emailVerifiedAt: null }));
    response = await request(app).post("/api/auth/login").send({ email: "student@byui.edu", password });
    expect(response.status).toBe(403);

    const verified = userFixture({ passwordHash });
    prismaMocks.user.findUnique.mockResolvedValue(verified);
    response = await request(app).post("/api/auth/login").send({ email: verified.email, password });
    expect(response.status).toBe(200);
    expect(response.body.data).not.toHaveProperty("passwordHash");
  });

  it("does not reveal password-reset account existence and sends a reset code for verified users", async () => {
    let response = await request(app).post("/api/auth/forgot-password").send({ email: "not-byui@example.com" });
    expect(response.status).toBe(202);
    expect(prismaMocks.user.findUnique).not.toHaveBeenCalled();

    const user = userFixture();
    prismaMocks.user.findUnique.mockResolvedValue(user);
    response = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    expect(response.status).toBe(202);
    expect(prismaMocks.passwordResetCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: user.id, codeHash: expect.any(String) }),
    });
    expect(sendAuthCode).toHaveBeenCalledWith(user.email, expect.any(String), "password reset");

    prismaMocks.user.findUnique.mockResolvedValue(userFixture({ emailVerifiedAt: null }));
    response = await request(app).post("/api/auth/forgot-password").send({ email: "unverified@byui.edu" });
    expect(response.status).toBe(202);
    expect(prismaMocks.passwordResetCode.create).toHaveBeenCalledTimes(1);
  });

  it("resets a password only for a valid reset code", async () => {
    const user = userFixture();
    prismaMocks.user.findUnique.mockResolvedValue(user);
    prismaMocks.passwordResetCode.findFirst.mockResolvedValue({
      id: "reset-code",
      attempts: 0,
      codeHash: hashToken("87654321"),
    });
    prismaMocks.$transaction.mockResolvedValue([]);

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: user.email, code: "87654321", password });

    expect(response.status).toBe(200);
    expect(prismaMocks.passwordResetCode.update).toHaveBeenCalledWith({
      where: { id: "reset-code" },
      data: { attempts: { increment: 1 } },
    });
    expect(prismaMocks.$transaction).toHaveBeenCalledWith(expect.any(Array));
  });

  it("rejects missing and mismatched password-reset codes", async () => {
    let response = await request(app).post("/api/auth/reset-password").send({ email: "missing@byui.edu", code: "12345678", password });
    expect(response.status).toBe(400);

    const user = userFixture();
    prismaMocks.user.findUnique.mockResolvedValue(user);
    prismaMocks.passwordResetCode.findFirst.mockResolvedValue({ id: "reset", attempts: 0, codeHash: hashToken("87654321") });
    response = await request(app).post("/api/auth/reset-password").send({ email: user.email, code: "12345678", password });
    expect(response.status).toBe(400);

    prismaMocks.passwordResetCode.findFirst.mockResolvedValue(null);
    response = await request(app).post("/api/auth/reset-password").send({ email: user.email, code: "12345678", password });
    expect(response.status).toBe(400);
  });

  it("gets the current user and invalidates a session during logout", async () => {
    const user = userFixture();
    prismaMocks.session.findUnique.mockResolvedValue({
      userId: user.id,
      user,
      revokedAt: null,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    prismaMocks.user.findUnique.mockResolvedValue(user);
    let response = await request(app).get("/api/auth/me").set("Cookie", "bgp_session=token");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt.toISOString() });

    response = await request(app).post("/api/auth/logout").set("Cookie", "bgp_session=token");
    expect(response.status).toBe(204);
    expect(prismaMocks.session.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: hashToken("token") } });

    prismaMocks.user.findUnique.mockResolvedValue(null);
    response = await request(app).get("/api/auth/me").set("Cookie", "bgp_session=token");
    expect(response.status).toBe(401);

    prismaMocks.session.deleteMany.mockClear();
    response = await request(app).post("/api/auth/logout");
    expect(response.status).toBe(204);
    expect(prismaMocks.session.deleteMany).not.toHaveBeenCalled();
  });

  it("rate limits repeated requests for the same action, address, and email", async () => {
    prismaMocks.user.findUnique.mockResolvedValue(null);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await request(app).post("/api/auth/forgot-password").send({ email: "rate-limit@byui.edu" })).status).toBe(202);
    }
    expect((await request(app).post("/api/auth/forgot-password").send({ email: "rate-limit@byui.edu" })).status).toBe(429);
  });
});
