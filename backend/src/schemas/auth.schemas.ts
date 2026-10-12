import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("must be a valid email address")
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string()
  .min(15, "must be at least 15 characters")
  .max(128, "must be no more than 128 characters");

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{8}$/, "must be an 8-digit code");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: codeSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: codeSchema,
  password: passwordSchema,
});
