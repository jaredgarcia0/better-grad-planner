import { Router } from "express";
import {
  createProgram,
  deleteProgram,
  getProgram,
  listProgramRequirements,
  listPrograms,
  updateProgram,
} from "../controllers/catalog.controller.js";
import { validate } from "../middleware/validate.js";
import { createProgramSchema, idParamsSchema, listProgramsSchema, universityChildQuerySchema, updateProgramSchema } from "../schemas/catalog.schemas.js";

export const programsRouter = Router();

programsRouter.get("/", validate({ query: listProgramsSchema }), listPrograms);
programsRouter.post("/", validate({ body: createProgramSchema }), createProgram);
programsRouter.get("/:id/requirements", validate({ params: idParamsSchema, query: universityChildQuerySchema }), listProgramRequirements);
programsRouter.get("/:id", validate({ params: idParamsSchema }), getProgram);
programsRouter.patch("/:id", validate({ params: idParamsSchema, body: updateProgramSchema }), updateProgram);
programsRouter.delete("/:id", validate({ params: idParamsSchema }), deleteProgram);
