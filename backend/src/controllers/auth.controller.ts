import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { sendAuthCode } from "../services/email.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  clearSessionCookie,
  CODE_DURATION_MS,
  codesMatch,
  createSessionToken,
  createVerificationCode,
  getCookie,
  hashPassword,
  hashToken,
  isByuiEmail,
  MAX_CODE_ATTEMPTS,
  normalizeEmail,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  setSessionCookie,
  verifyPassword,
} from "../utils/auth.js";
import { HttpError } from "../utils/httpError.js";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const dummyPasswordHash = hashPassword("this-is-not-a-real-user-password");

function enforceRateLimit(key: string, limit: number): void {
  const now = Date.now();
  const existing = rateLimits.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  if (existing.count >= limit) {
    throw new HttpError(429, "Too many attempts. Please try again later.");
  }
  existing.count += 1;
}

function requestKey(req: Request, prefix: string, email: string): string {
  return `${prefix}:${req.ip}:${email}`;
}

function publicUser(user: {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

function expiresAt(): Date {
  return new Date(Date.now() + CODE_DURATION_MS);
}

async function issueEmailVerificationCode(
  userId: string,
  email: string,
): Promise<void> {
  const code = createVerificationCode();
  await prisma.emailVerificationCode.deleteMany({
    where: { userId, usedAt: null },
  });
  await prisma.emailVerificationCode.create({
    data: {
      userId,
      codeHash: hashToken(code),
      expiresAt: expiresAt(),
    },
  });
  await sendAuthCode(email, code, "email verification");
}

async function issuePasswordResetCode(
  userId: string,
  email: string,
): Promise<void> {
  const code = createVerificationCode();
  await prisma.passwordResetCode.deleteMany({
    where: { userId, usedAt: null },
  });
  await prisma.passwordResetCode.create({
    data: {
      userId,
      codeHash: hashToken(code),
      expiresAt: expiresAt(),
    },
  });
  await sendAuthCode(email, code, "password reset");
}

async function createSession(userId: string): Promise<string> {
  const token = createSessionToken();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
  return token;
}

export const register = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email as string);
  const password = req.body.password as string;
  if (!isByuiEmail(email)) {
    throw new HttpError(
      400,
      "Registration requires a @byui.edu email address.",
    );
  }

  enforceRateLimit(requestKey(req, "register", email), 5);
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email } });

  const user = existing
    ? existing.emailVerifiedAt
      ? null
      : await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash },
        })
    : await prisma.user.create({ data: { email, passwordHash } });

  if (!user)
    throw new HttpError(409, "An account with that email already exists.");
  await issueEmailVerificationCode(user.id, email);
  res.status(existing ? 200 : 201).json({
    message: "Check your BYU-Idaho email for a verification code.",
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email as string);
  const code = req.body.code as string;
  enforceRateLimit(requestKey(req, "verify", email), 10);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !isByuiEmail(email)) {
    throw new HttpError(400, "The verification code is invalid or expired.");
  }

  const verification = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification || verification.attempts >= MAX_CODE_ATTEMPTS) {
    throw new HttpError(400, "The verification code is invalid or expired.");
  }

  await prisma.emailVerificationCode.update({
    where: { id: verification.id },
    data: { attempts: { increment: 1 } },
  });

  if (!codesMatch(code, verification.codeHash)) {
    throw new HttpError(400, "The verification code is invalid or expired.");
  }

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  await prisma.emailVerificationCode.update({
    where: { id: verification.id },
    data: { usedAt: new Date() },
  });

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.json({ data: publicUser(verifiedUser) });
});

export const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email as string);
  const password = req.body.password as string;
  enforceRateLimit(requestKey(req, "login", email), 10);

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
  const passwordValid = await verifyPassword(passwordHash, password);

  if (!user || !passwordValid) {
    throw new HttpError(401, "Invalid email or password.");
  }
  if (!user.emailVerifiedAt) {
    throw new HttpError(403, "Please verify your email before logging in.");
  }

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.json({ data: publicUser(user) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email as string);
  enforceRateLimit(requestKey(req, "forgot", email), 3);

  if (isByuiEmail(email)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.emailVerifiedAt) await issuePasswordResetCode(user.id, email);
  }

  res.status(202).json({
    message:
      "If an account exists for that email, a password reset code will be sent.",
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email as string);
  const code = req.body.code as string;
  const password = req.body.password as string;
  enforceRateLimit(requestKey(req, "reset", email), 10);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(400, "The reset code is invalid or expired.");

  const resetCode = await prisma.passwordResetCode.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!resetCode || resetCode.attempts >= MAX_CODE_ATTEMPTS) {
    throw new HttpError(400, "The reset code is invalid or expired.");
  }

  await prisma.passwordResetCode.update({
    where: { id: resetCode.id },
    data: { attempts: { increment: 1 } },
  });

  if (!codesMatch(code, resetCode.codeHash)) {
    throw new HttpError(400, "The reset code is invalid or expired.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  res.json({ message: "Your password has been reset. You can now log in." });
});

export const currentUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
  });
  if (!user) throw new HttpError(401, "Authentication is required.");
  res.json({ data: publicUser(user) });
});

export const logout = asyncHandler(async (req, res) => {
  const token = getCookie(req, SESSION_COOKIE_NAME);
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  clearSessionCookie(res);
  res.status(204).send();
});
