import { Router } from "express";
import {
  createRequirementCourseLink,
  deleteRequirementCourseLink,
  getRequirementCourseLink,
  listRequirementCourseLinks,
  updateRequirementCourseLink,
} from "../controllers/catalog.controller.js";

export const requirementCoursesRouter = Router();

requirementCoursesRouter.get("/", listRequirementCourseLinks);
requirementCoursesRouter.post("/", createRequirementCourseLink);
requirementCoursesRouter.get("/:id", getRequirementCourseLink);
requirementCoursesRouter.patch("/:id", updateRequirementCourseLink);
requirementCoursesRouter.delete("/:id", deleteRequirementCourseLink);
