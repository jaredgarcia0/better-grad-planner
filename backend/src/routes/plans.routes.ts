import { Router } from "express";
import {
  createDegreePlan,
  createPlannedCourse,
  deleteDegreePlan,
  deletePlannedCourse,
  getDegreePlan,
  getPlannedCourse,
  listDegreePlans,
  listPlannedCourses,
  updateDegreePlan,
  updatePlannedCourse,
} from "../controllers/student-records.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createDegreePlanSchema,
  createPlannedCourseSchema,
  idParamsSchema,
  listDegreePlansSchema,
  listPlannedCoursesSchema,
  planCourseParamsSchema,
  planIdParamsSchema,
  updateDegreePlanSchema,
  updatePlannedCourseSchema,
} from "../schemas/student-records.schemas.js";

export const plansRouter = Router();

plansRouter.use(requireAuth);

plansRouter.get("/", validate({ query: listDegreePlansSchema }), listDegreePlans);
plansRouter.post("/", validate({ body: createDegreePlanSchema }), createDegreePlan);
plansRouter.get(
  "/:planId/courses",
  validate({ params: planIdParamsSchema, query: listPlannedCoursesSchema }),
  listPlannedCourses,
);
plansRouter.post(
  "/:planId/courses",
  validate({ params: planIdParamsSchema, body: createPlannedCourseSchema }),
  createPlannedCourse,
);
plansRouter.get(
  "/:planId/courses/:courseEntryId",
  validate({ params: planCourseParamsSchema }),
  getPlannedCourse,
);
plansRouter.patch(
  "/:planId/courses/:courseEntryId",
  validate({ params: planCourseParamsSchema, body: updatePlannedCourseSchema }),
  updatePlannedCourse,
);
plansRouter.delete(
  "/:planId/courses/:courseEntryId",
  validate({ params: planCourseParamsSchema }),
  deletePlannedCourse,
);
plansRouter.get("/:id", validate({ params: idParamsSchema }), getDegreePlan);
plansRouter.patch(
  "/:id",
  validate({ params: idParamsSchema, body: updateDegreePlanSchema }),
  updateDegreePlan,
);
plansRouter.delete("/:id", validate({ params: idParamsSchema }), deleteDegreePlan);
