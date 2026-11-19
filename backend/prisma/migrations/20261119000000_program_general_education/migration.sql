-- Store the catalog-selected general education program for each major.
ALTER TABLE "DegreeProgram"
ADD COLUMN "generalEducationProgramId" UUID;

CREATE INDEX "DegreeProgram_generalEducationProgramId_idx"
ON "DegreeProgram"("generalEducationProgramId");

ALTER TABLE "DegreeProgram"
ADD CONSTRAINT "DegreeProgram_generalEducationProgramId_fkey"
FOREIGN KEY ("generalEducationProgramId") REFERENCES "DegreeProgram"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
