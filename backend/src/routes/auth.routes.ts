import { Router } from "express";
import {
  currentUser,
  forgotPassword,
  login,
  logout,
  register,
  resetPassword,
  verifyEmail,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../schemas/auth.schemas.js";

export const authRouter = Router();

authRouter.post("/register", validate({ body: registerSchema }), register);
authRouter.post("/verify-email", validate({ body: verifyEmailSchema }), verifyEmail);
authRouter.post("/login", validate({ body: loginSchema }), login);
authRouter.post("/forgot-password", validate({ body: forgotPasswordSchema }), forgotPassword);
authRouter.post("/reset-password", validate({ body: resetPasswordSchema }), resetPassword);
authRouter.get("/me", requireAuth, currentUser);
authRouter.post("/logout", logout);
