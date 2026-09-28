import { Router } from "express";
import {
  createOffering,
  deleteOffering,
  getOffering,
  listOfferings,
  updateOffering,
} from "../controllers/catalog.controller.js";

export const offeringsRouter = Router();

offeringsRouter.get("/", listOfferings);
offeringsRouter.post("/", createOffering);
offeringsRouter.get("/:id", getOffering);
offeringsRouter.patch("/:id", updateOffering);
offeringsRouter.delete("/:id", deleteOffering);
