import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMocks, resetPrismaMocks } from "../support/prisma-mocks.js";

vi.mock("../../src/lib/prisma.js", () => ({ prisma: prismaMocks }));

import { requireAuth } from "../../src/middleware/auth.js";
import { hashToken } from "../../src/utils/auth.js";

function run(req: any) {
  const next = vi.fn();
  const res = {} as any;
  const promise = new Promise<void>((resolve) => {
    requireAuth(req, res, (...args: any[]) => {
      next(...args);
      resolve();
    });
  });
  return { next, promise, req };
}

describe("requireAuth", () => {
  beforeEach(() => resetPrismaMocks());

  it("rejects missing cookies before accessing Prisma", async () => {
    const { next, promise } = run({ headers: {} });
    await promise;
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(prismaMocks.session.findUnique).not.toHaveBeenCalled();
  });

  it("looks up the hashed token and attaches the authenticated user for a valid session", async () => {
    const user = { id: "user-1", email: "student@byui.edu" };
    prismaMocks.session.findUnique.mockResolvedValue({
      userId: user.id,
      user,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const { next, promise, req } = run({ headers: { cookie: "bgp_session=secret" } });
    await promise;
    expect(prismaMocks.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("secret") },
      include: { user: true },
    });
    expect(req.userId).toBe(user.id);
    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    [{ userId: "user-1", user: { id: "user-1" }, revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }],
    [{ userId: "user-1", user: { id: "user-1" }, revokedAt: null, expiresAt: new Date(Date.now() - 60_000) }],
    [null],
  ])("rejects revoked, expired, or unknown sessions", async (session) => {
    prismaMocks.session.findUnique.mockResolvedValue(session);
    const { next, promise } = run({ headers: { cookie: "bgp_session=secret" } });
    await promise;
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("forwards Prisma lookup failures to next", async () => {
    const failure = new Error("database unavailable");
    prismaMocks.session.findUnique.mockRejectedValue(failure);
    const { next, promise } = run({ headers: { cookie: "bgp_session=secret" } });
    await promise;
    expect(next).toHaveBeenCalledWith(failure);
  });
});
