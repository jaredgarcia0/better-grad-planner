import { Router } from "express";
import {
  createCompletedCourse,
  deleteCompletedCourse,
  getCompletedCourse,
  listCompletedCourses,
  updateCompletedCourse,
} from "../controllers/student-records.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createCompletedCourseSchema,
  idParamsSchema,
  listCompletedCoursesSchema,
  updateCompletedCourseSchema,
} from "../schemas/student-records.schemas.js";

export const completedCoursesRouter = Router();

completedCoursesRouter.use(requireAuth);
completedCoursesRouter.get("/", validate({ query: listCompletedCoursesSchema }), listCompletedCourses);
completedCoursesRouter.post("/", validate({ body: createCompletedCourseSchema }), createCompletedCourse);
completedCoursesRouter.get("/:id", validate({ params: idParamsSchema }), getCompletedCourse);
completedCoursesRouter.patch(
  "/:id",
  validate({ params: idParamsSchema, body: updateCompletedCourseSchema }),
  updateCompletedCourse,
);
completedCoursesRouter.delete("/:id", validate({ params: idParamsSchema }), deleteCompletedCourse);
