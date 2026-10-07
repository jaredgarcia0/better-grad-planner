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
import { validate } from "../middleware/validate.js";
import {
  createUniversitySchema,
  idParamsSchema,
  listUniversitiesSchema,
  universityChildQuerySchema,
  updateUniversitySchema,
} from "../schemas/catalog.schemas.js";

export const universitiesRouter = Router();

universitiesRouter.get("/", validate({ query: listUniversitiesSchema }), listUniversities);
universitiesRouter.post("/", validate({ body: createUniversitySchema }), createUniversity);
universitiesRouter.get("/:id/departments", validate({ params: idParamsSchema, query: universityChildQuerySchema }), listUniversityDepartments);
universitiesRouter.get("/:id/programs", validate({ params: idParamsSchema, query: universityChildQuerySchema }), listUniversityPrograms);
universitiesRouter.get("/:id/courses", validate({ params: idParamsSchema, query: universityChildQuerySchema }), listUniversityCourses);
universitiesRouter.get("/:id", validate({ params: idParamsSchema }), getUniversity);
universitiesRouter.patch("/:id", validate({ params: idParamsSchema, body: updateUniversitySchema }), updateUniversity);
universitiesRouter.delete("/:id", validate({ params: idParamsSchema }), deleteUniversity);
