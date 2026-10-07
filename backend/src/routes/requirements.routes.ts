import { Router } from "express";
import {
  createRequirement,
  deleteRequirement,
  getRequirement,
  listRequirementCourses,
  listRequirements,
  updateRequirement,
} from "../controllers/catalog.controller.js";
import { validate } from "../middleware/validate.js";
import { createRequirementSchema, idParamsSchema, listRequirementsSchema, universityChildQuerySchema, updateRequirementSchema } from "../schemas/catalog.schemas.js";

export const requirementsRouter = Router();

requirementsRouter.get("/", validate({ query: listRequirementsSchema }), listRequirements);
requirementsRouter.post("/", validate({ body: createRequirementSchema }), createRequirement);
requirementsRouter.get("/:id/courses", validate({ params: idParamsSchema, query: universityChildQuerySchema }), listRequirementCourses);
requirementsRouter.get("/:id", validate({ params: idParamsSchema }), getRequirement);
requirementsRouter.patch("/:id", validate({ params: idParamsSchema, body: updateRequirementSchema }), updateRequirement);
requirementsRouter.delete("/:id", validate({ params: idParamsSchema }), deleteRequirement);
