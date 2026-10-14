import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { HttpError } from "../utils/httpError.js";

type Schemas = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

function parse(name: string, schema: ZodType, value: unknown) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const updateMessage = result.error.issues.find(
    (issue) => issue.message === "At least one field must be supplied for an update.",
  )?.message;

  throw new HttpError(
    400,
    updateMessage ?? `${name} validation failed.`,
    result.error.flatten(),
  );
}

/** Validate and replace request values before the controller executes. */
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = parse("body", schemas.body, req.body);
      if (schemas.params) req.params = parse("params", schemas.params, req.params) as typeof req.params;
      if (schemas.query) {
        Object.defineProperty(req, "query", {
          configurable: true,
          enumerable: true,
          value: parse("query", schemas.query, req.query),
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
