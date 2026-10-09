import { Router } from "express";
import {
  createRequirementCourseLink,
  deleteRequirementCourseLink,
  getRequirementCourseLink,
  listRequirementCourseLinks,
  updateRequirementCourseLink,
} from "../controllers/requirement-courses.controller.js";
import { validate } from "../middleware/validate.js";
import { createRequirementCourseSchema, idParamsSchema, listRequirementCoursesSchema, updateRequirementCourseSchema } from "../schemas/catalog.schemas.js";

export const requirementCoursesRouter = Router();

requirementCoursesRouter.get("/", validate({ query: listRequirementCoursesSchema }), listRequirementCourseLinks);
requirementCoursesRouter.post("/", validate({ body: createRequirementCourseSchema }), createRequirementCourseLink);
requirementCoursesRouter.get("/:id", validate({ params: idParamsSchema }), getRequirementCourseLink);
requirementCoursesRouter.patch("/:id", validate({ params: idParamsSchema, body: updateRequirementCourseSchema }), updateRequirementCourseLink);
requirementCoursesRouter.delete("/:id", validate({ params: idParamsSchema }), deleteRequirementCourseLink);
