import { Router } from "express";
import {
  createCourse,
  deleteCourse,
  getCourse,
  listCourseOfferings,
  listCoursePrerequisites,
  listCourses,
  updateCourse,
} from "../controllers/catalog.controller.js";

export const coursesRouter = Router();

coursesRouter.get("/", listCourses);
coursesRouter.post("/", createCourse);
coursesRouter.get("/:id/prerequisites", listCoursePrerequisites);
coursesRouter.get("/:id/offerings", listCourseOfferings);
coursesRouter.get("/:id", getCourse);
coursesRouter.patch("/:id", updateCourse);
coursesRouter.delete("/:id", deleteCourse);
