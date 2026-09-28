import { Router } from "express";
import {
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from "../controllers/catalog.controller.js";

export const departmentsRouter = Router();

departmentsRouter.get("/", listDepartments);
departmentsRouter.post("/", createDepartment);
departmentsRouter.get("/:id", getDepartment);
departmentsRouter.patch("/:id", updateDepartment);
departmentsRouter.delete("/:id", deleteDepartment);
