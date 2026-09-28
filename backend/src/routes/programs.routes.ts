import { Router } from "express";
import {
  createProgram,
  deleteProgram,
  getProgram,
  listProgramRequirements,
  listPrograms,
  updateProgram,
} from "../controllers/catalog.controller.js";

export const programsRouter = Router();

programsRouter.get("/", listPrograms);
programsRouter.post("/", createProgram);
programsRouter.get("/:id/requirements", listProgramRequirements);
programsRouter.get("/:id", getProgram);
programsRouter.patch("/:id", updateProgram);
programsRouter.delete("/:id", deleteProgram);
