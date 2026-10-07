import { Router } from "express";
import {
  createPrerequisite,
  deletePrerequisite,
  getPrerequisite,
  listPrerequisites,
  updatePrerequisite,
} from "../controllers/catalog.controller.js";
import { validate } from "../middleware/validate.js";
import { createPrerequisiteSchema, idParamsSchema, listPrerequisitesSchema, updatePrerequisiteSchema } from "../schemas/catalog.schemas.js";

export const prerequisitesRouter = Router();

prerequisitesRouter.get("/", validate({ query: listPrerequisitesSchema }), listPrerequisites);
prerequisitesRouter.post("/", validate({ body: createPrerequisiteSchema }), createPrerequisite);
prerequisitesRouter.get("/:id", validate({ params: idParamsSchema }), getPrerequisite);
prerequisitesRouter.patch("/:id", validate({ params: idParamsSchema, body: updatePrerequisiteSchema }), updatePrerequisite);
prerequisitesRouter.delete("/:id", validate({ params: idParamsSchema }), deletePrerequisite);
