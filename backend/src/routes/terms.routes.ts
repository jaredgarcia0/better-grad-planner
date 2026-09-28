import { Router } from "express";
import {
  createTerm,
  deleteTerm,
  getTerm,
  listTermOfferings,
  listTerms,
  updateTerm,
} from "../controllers/catalog.controller.js";

export const termsRouter = Router();

termsRouter.get("/", listTerms);
termsRouter.post("/", createTerm);
termsRouter.get("/:id/offerings", listTermOfferings);
termsRouter.get("/:id", getTerm);
termsRouter.patch("/:id", updateTerm);
termsRouter.delete("/:id", deleteTerm);
