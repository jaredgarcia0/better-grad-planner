import { Router } from "express";
import {
  createPrerequisite,
  deletePrerequisite,
  getPrerequisite,
  listPrerequisites,
  updatePrerequisite,
} from "../controllers/catalog.controller.js";

export const prerequisitesRouter = Router();

prerequisitesRouter.get("/", listPrerequisites);
prerequisitesRouter.post("/", createPrerequisite);
prerequisitesRouter.get("/:id", getPrerequisite);
prerequisitesRouter.patch("/:id", updatePrerequisite);
prerequisitesRouter.delete("/:id", deletePrerequisite);
