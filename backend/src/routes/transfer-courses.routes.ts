import { Router } from "express";
import {
  createTransferCourse,
  deleteTransferCourse,
  getTransferCourse,
  listTransferCourses,
  updateTransferCourse,
} from "../controllers/student-records.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createTransferCourseSchema,
  idParamsSchema,
  listTransferCoursesSchema,
  updateTransferCourseSchema,
} from "../schemas/student-records.schemas.js";

export const transferCoursesRouter = Router();

transferCoursesRouter.use(requireAuth);
transferCoursesRouter.get("/", validate({ query: listTransferCoursesSchema }), listTransferCourses);
transferCoursesRouter.post("/", validate({ body: createTransferCourseSchema }), createTransferCourse);
transferCoursesRouter.get("/:id", validate({ params: idParamsSchema }), getTransferCourse);
transferCoursesRouter.patch(
  "/:id",
  validate({ params: idParamsSchema, body: updateTransferCourseSchema }),
  updateTransferCourse,
);
transferCoursesRouter.delete("/:id", validate({ params: idParamsSchema }), deleteTransferCourse);
