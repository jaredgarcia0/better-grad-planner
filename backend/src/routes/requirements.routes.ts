import { Router } from "express";
import {
  createRequirement,
  deleteRequirement,
  getRequirement,
  listRequirementCourses,
  listRequirements,
  updateRequirement,
} from "../controllers/catalog.controller.js";

export const requirementsRouter = Router();

requirementsRouter.get("/", listRequirements);
requirementsRouter.post("/", createRequirement);
requirementsRouter.get("/:id/courses", listRequirementCourses);
requirementsRouter.get("/:id", getRequirement);
requirementsRouter.patch("/:id", updateRequirement);
requirementsRouter.delete("/:id", deleteRequirement);
