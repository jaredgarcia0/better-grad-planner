-- Enable indexed substring searches used by catalog endpoints.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "University_name_trgm_idx"
  ON "University" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Department_name_trgm_idx"
  ON "Department" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Department_code_trgm_idx"
  ON "Department" USING GIN ("code" gin_trgm_ops);

CREATE INDEX "DegreeProgram_name_trgm_idx"
  ON "DegreeProgram" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "DegreeProgram_code_trgm_idx"
  ON "DegreeProgram" USING GIN ("code" gin_trgm_ops);

CREATE INDEX "Course_code_trgm_idx"
  ON "Course" USING GIN ("code" gin_trgm_ops);

CREATE INDEX "Course_title_trgm_idx"
  ON "Course" USING GIN ("title" gin_trgm_ops);

CREATE INDEX "AcademicTerm_name_trgm_idx"
  ON "AcademicTerm" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "AcademicTerm_code_trgm_idx"
  ON "AcademicTerm" USING GIN ("code" gin_trgm_ops);
