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
import { validate } from "../middleware/validate.js";
import {
  createCourseSchema,
  idParamsSchema,
  listCoursesSchema,
  universityChildQuerySchema,
  updateCourseSchema,
} from "../schemas/catalog.schemas.js";

export const coursesRouter = Router();

coursesRouter.get("/", validate({ query: listCoursesSchema }), listCourses);
coursesRouter.post("/", validate({ body: createCourseSchema }), createCourse);
coursesRouter.get(
  "/:id/prerequisites",
  validate({ params: idParamsSchema, query: universityChildQuerySchema }),
  listCoursePrerequisites,
);
coursesRouter.get(
  "/:id/offerings",
  validate({ params: idParamsSchema, query: universityChildQuerySchema }),
  listCourseOfferings,
);
coursesRouter.get("/:id", validate({ params: idParamsSchema }), getCourse);
coursesRouter.patch(
  "/:id",
  validate({ params: idParamsSchema, body: updateCourseSchema }),
  updateCourse,
);
coursesRouter.delete(
  "/:id",
  validate({ params: idParamsSchema }),
  deleteCourse,
);
