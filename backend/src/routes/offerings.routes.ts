import { Router } from "express";
import {
  createOffering,
  deleteOffering,
  getOffering,
  listOfferings,
  updateOffering,
} from "../controllers/offerings.controller.js";
import { validate } from "../middleware/validate.js";
import { createOfferingSchema, idParamsSchema, listOfferingsSchema, updateOfferingSchema } from "../schemas/catalog.schemas.js";

export const offeringsRouter = Router();

offeringsRouter.get("/", validate({ query: listOfferingsSchema }), listOfferings);
offeringsRouter.post("/", validate({ body: createOfferingSchema }), createOffering);
offeringsRouter.get("/:id", validate({ params: idParamsSchema }), getOffering);
offeringsRouter.patch("/:id", validate({ params: idParamsSchema, body: updateOfferingSchema }), updateOffering);
offeringsRouter.delete("/:id", validate({ params: idParamsSchema }), deleteOffering);
