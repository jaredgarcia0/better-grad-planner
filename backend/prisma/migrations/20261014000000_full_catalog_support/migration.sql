-- AlterEnum
-- Minors, clusters and GE programs get their own degree types.
-- Adding several values in one migration requires PostgreSQL 12+ (Neon runs 14+).
-- IF NOT EXISTS keeps this safe on databases that were synced with `prisma db push`.
ALTER TYPE "DegreeType" ADD VALUE IF NOT EXISTS 'MINOR';
ALTER TYPE "DegreeType" ADD VALUE IF NOT EXISTS 'CLUSTER';
ALTER TYPE "DegreeType" ADD VALUE IF NOT EXISTS 'GENERAL_EDUCATION';

-- AlterTable
-- Credits can be fractional (e.g. 0.5-credit courses). SMALLINT casts to
-- DOUBLE PRECISION implicitly, so existing values are preserved.
ALTER TABLE "DegreeProgram" ALTER COLUMN "totalCredits" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "RequirementGroup" ALTER COLUMN "minCredits" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "maxCredits" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "RequirementCourse" ALTER COLUMN "creditsOverride" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "credits" SET DATA TYPE DOUBLE PRECISION;
