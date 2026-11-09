-- Additive only: legacy plans and UUID academic-term links remain intact.
ALTER TABLE "DegreePlan"
ADD COLUMN "dashboardLayout" JSONB,
ADD COLUMN "programs" JSONB,
ADD COLUMN "startTerm" TEXT,
ADD COLUMN "endTerm" TEXT;

ALTER TABLE "PlannedCourse" ADD COLUMN "termKey" TEXT;
