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
  return { next, promise };
}

describe("requireAuth", () => {
  beforeEach(() => resetPrismaMocks());

  it("rejects missing cookies before accessing Prisma", async () => {
    const { next, promise } = run({ headers: {} });
    await promise;
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(prismaMocks.session.findUnique).not.toHaveBeenCalled();
  });

  it("looks up the hashed token and attaches the user id for a valid session", async () => {
    prismaMocks.session.findUnique.mockResolvedValue({ userId: "user-1", revokedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    const { next, promise } = run({ headers: { cookie: "bgp_session=secret" } });
    await promise;
    expect(prismaMocks.session.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashToken("secret") } });
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    [{ userId: "user-1", revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }],
    [{ userId: "user-1", revokedAt: null, expiresAt: new Date(Date.now() - 60_000) }],
    [null],
  ])("rejects revoked, expired, or unknown sessions", async (session) => {
    prismaMocks.session.findUnique.mockResolvedValue(session);
    const { next, promise } = run({ headers: { cookie: "bgp_session=secret" } });
    await promise;
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
