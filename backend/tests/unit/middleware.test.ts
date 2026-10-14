import express, { type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { validate } from "../../src/middleware/validate.js";
import { HttpError } from "../../src/utils/httpError.js";

function testApp() {
  const app = express();
  app.use(express.json());
  app.post(
    "/items/:id",
    validate({
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ active: z.coerce.boolean().optional() }),
      body: z.object({ name: z.string().trim().min(1) }),
    }),
    (req, res) => res.json({ body: req.body, params: req.params, query: req.query }),
  );
  app.use(errorHandler);
  return app;
}

describe("validation middleware", () => {
  it("replaces body, params, and query with parsed values before the controller", async () => {
    const response = await request(testApp())
      .post("/items/123e4567-e89b-42d3-a456-426614174000?active=true&unknown=removed")
      .send({ name: "  Item  ", unknown: "removed" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      body: { name: "Item" },
      params: { id: "123e4567-e89b-42d3-a456-426614174000" },
      query: { active: true },
    });
  });

  it("forwards validation failures as 400 responses and does not run the handler", async () => {
    const handler = vi.fn((_req: Request, res: Response) => res.sendStatus(200));
    const app = express();
    app.use(express.json());
    app.post("/items/:id", validate({ params: z.object({ id: z.string().uuid() }) }), handler);
    app.use(errorHandler);

    const response = await request(app).post("/items/not-a-uuid").send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("params validation failed.");
    expect(response.body.details).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it("preserves the special empty-update error message", async () => {
    const app = express();
    app.use(express.json());
    const updateSchema = z.preprocess(
      (value, ctx) => {
        if (value && typeof value === "object" && Object.keys(value).length === 0) {
          ctx.addIssue({ code: "custom", message: "At least one field must be supplied for an update." });
        }
        return value;
      },
      z.object({ name: z.string().optional() }).partial(),
    );
    app.patch("/items", validate({ body: updateSchema }), (_req, res) => res.sendStatus(200));
    app.use(errorHandler);

    const response = await request(app).patch("/items").send({});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("At least one field must be supplied for an update.");
  });

  it("returns a 400 response for malformed JSON", async () => {
    const response = await request(testApp())
      .post("/items/123e4567-e89b-42d3-a456-426614174000")
      .set("Content-Type", "application/json")
      .send('{"name":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Malformed JSON request." });
  });
});

describe("error handler", () => {
  it.each([
    ["P2002", 409, "A record with those unique values already exists."],
    ["P2025", 404, "The requested record was not found."],
    ["P2003", 400, "A referenced record does not exist."],
  ])("maps Prisma %s", async (code, status, message) => {
    const app = express();
    app.get("/error", (_req, _res, next) => next({ code }));
    app.use(errorHandler);
    const response = await request(app).get("/error");
    expect(response.status).toBe(status);
    expect(response.body).toEqual({ error: message });
  });

  it("maps HttpError and unexpected errors", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = express();
    app.get("/http", (_req, _res, next) => next(new HttpError(418, "No tea", { reason: "empty" })));
    app.get("/unexpected", (_req, _res, next) => next(new Error("boom")));
    app.use(errorHandler);

    expect((await request(app).get("/http")).body).toEqual({
      error: "No tea",
      details: { reason: "empty" },
    });
    expect((await request(app).get("/unexpected")).body).toEqual({ error: "Internal server error." });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
