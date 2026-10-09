import { Router } from "express";
import {
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from "../controllers/departments.controller.js";
import { validate } from "../middleware/validate.js";
import { createDepartmentSchema, idParamsSchema, listDepartmentsSchema, updateDepartmentSchema } from "../schemas/catalog.schemas.js";

export const departmentsRouter = Router();

departmentsRouter.get("/", validate({ query: listDepartmentsSchema }), listDepartments);
departmentsRouter.post("/", validate({ body: createDepartmentSchema }), createDepartment);
departmentsRouter.get("/:id", validate({ params: idParamsSchema }), getDepartment);
departmentsRouter.patch("/:id", validate({ params: idParamsSchema, body: updateDepartmentSchema }), updateDepartment);
departmentsRouter.delete("/:id", validate({ params: idParamsSchema }), deleteDepartment);
