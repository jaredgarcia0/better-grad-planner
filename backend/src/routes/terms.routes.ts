import { Router } from "express";
import {
  createTerm,
  deleteTerm,
  getTerm,
  listTermOfferings,
  listTerms,
  updateTerm,
} from "../controllers/terms.controller.js";
import { validate } from "../middleware/validate.js";
import { createTermSchema, idParamsSchema, listTermsSchema, universityChildQuerySchema, updateTermSchema } from "../schemas/catalog.schemas.js";

export const termsRouter = Router();

termsRouter.get("/", validate({ query: listTermsSchema }), listTerms);
termsRouter.post("/", validate({ body: createTermSchema }), createTerm);
termsRouter.get("/:id/offerings", validate({ params: idParamsSchema, query: universityChildQuerySchema }), listTermOfferings);
termsRouter.get("/:id", validate({ params: idParamsSchema }), getTerm);
termsRouter.patch("/:id", validate({ params: idParamsSchema, body: updateTermSchema }), updateTerm);
termsRouter.delete("/:id", validate({ params: idParamsSchema }), deleteTerm);
