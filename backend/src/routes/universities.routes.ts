import { Router } from "express";
import {
  createUniversity,
  deleteUniversity,
  getUniversity,
  listUniversities,
  listUniversityCourses,
  listUniversityDepartments,
  listUniversityPrograms,
  updateUniversity,
} from "../controllers/catalog.controller.js";

export const universitiesRouter = Router();

universitiesRouter.get("/", listUniversities);
universitiesRouter.post("/", createUniversity);
universitiesRouter.get("/:id/departments", listUniversityDepartments);
universitiesRouter.get("/:id/programs", listUniversityPrograms);
universitiesRouter.get("/:id/courses", listUniversityCourses);
universitiesRouter.get("/:id", getUniversity);
universitiesRouter.patch("/:id", updateUniversity);
universitiesRouter.delete("/:id", deleteUniversity);
