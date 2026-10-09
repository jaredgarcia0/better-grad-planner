import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { coursesRouter } from "./routes/courses.routes.js";
import { departmentsRouter } from "./routes/departments.routes.js";
import { offeringsRouter } from "./routes/offerings.routes.js";
import { prerequisitesRouter } from "./routes/prerequisites.routes.js";
import { programsRouter } from "./routes/programs.routes.js";
import { requirementCoursesRouter } from "./routes/requirement-courses.routes.js";
import { requirementsRouter } from "./routes/requirements.routes.js";
import { termsRouter } from "./routes/terms.routes.js";
import { universitiesRouter } from "./routes/universities.routes.js";

export const app = express();

const configuredOrigins = process.env.CLIENT_ORIGIN?.split(",").map((origin) => origin.trim());
const corsOrigin = configuredOrigins?.length === 1 && configuredOrigins[0] === "*"
  ? "*"
  : configuredOrigins ?? "*";

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/universities", universitiesRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/programs", programsRouter);
app.use("/api/requirements", requirementsRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/requirement-courses", requirementCoursesRouter);
app.use("/api/prerequisites", prerequisitesRouter);
app.use("/api/terms", termsRouter);
app.use("/api/offerings", offeringsRouter);

app.use(notFound);
app.use(errorHandler);
