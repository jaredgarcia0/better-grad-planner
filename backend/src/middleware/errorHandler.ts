import type { ErrorRequestHandler } from "express";
import { HttpError } from "../utils/httpError.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  const prismaCode = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;

  if (prismaCode === "P2002") {
    res.status(409).json({ error: "A record with those unique values already exists." });
    return;
  }

  if (prismaCode === "P2025") {
    res.status(404).json({ error: "The requested record was not found." });
    return;
  }

  if (prismaCode === "P2003") {
    res.status(400).json({ error: "A referenced record does not exist." });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error." });
};
