import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getCookie, hashToken, SESSION_COOKIE_NAME } from "../utils/auth.js";
import { HttpError } from "../utils/httpError.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = getCookie(req, SESSION_COOKIE_NAME);
  if (!token) throw new HttpError(401, "Authentication is required.");

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw new HttpError(401, "Your session has expired. Please log in again.");
  }

  req.userId = session.userId;
  next();
});
