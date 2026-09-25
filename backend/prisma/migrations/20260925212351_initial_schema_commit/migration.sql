-- CreateEnum
CREATE TYPE "DegreeType" AS ENUM ('ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('REQUIRED', 'ELECTIVE', 'CONCENTRATION', 'GENERAL_EDUCATION', 'CAPSTONE', 'OTHER');

-- CreateEnum
CREATE TYPE "RequirementOperator" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "PrerequisiteType" AS ENUM ('PREREQUISITE', 'COREQUISITE');

-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('INTRODUCTORY', 'INTERMEDIATE', 'ADVANCED', 'GRADUATE');

-- CreateTable
CREATE TABLE "University" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "universityId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DegreeProgram" (
    "id" UUID NOT NULL,
    "universityId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degreeType" "DegreeType" NOT NULL,
    "catalogYear" INTEGER,
    "description" TEXT,
    "totalCredits" SMALLINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DegreeProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementGroup" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requirementType" "RequirementType" NOT NULL,
    "operator" "RequirementOperator" NOT NULL DEFAULT 'ALL',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "minCourses" INTEGER,
    "maxCourses" INTEGER,
    "minCredits" SMALLINT,
    "maxCredits" SMALLINT,

    CONSTRAINT "RequirementGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementCourse" (
    "id" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "minGrade" TEXT,
    "creditsOverride" SMALLINT,

    CONSTRAINT "RequirementCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "universityId" UUID NOT NULL,
    "departmentId" UUID,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "credits" SMALLINT NOT NULL,
    "level" "CourseLevel",
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePrerequisite" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "prerequisiteCourseId" UUID NOT NULL,
    "type" "PrerequisiteType" NOT NULL DEFAULT 'PREREQUISITE',
    "groupNumber" INTEGER NOT NULL DEFAULT 0,
    "isAlternative" BOOLEAN NOT NULL DEFAULT false,
    "minimumGrade" TEXT,

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" UUID NOT NULL,
    "universityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "sectionCode" TEXT,
    "instructor" TEXT,
    "meetingInfo" TEXT,
    "capacity" INTEGER,
    "seatsOpen" INTEGER,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "University_name_idx" ON "University"("name");

-- CreateIndex
CREATE INDEX "Department_universityId_name_idx" ON "Department"("universityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_universityId_code_key" ON "Department"("universityId", "code");

-- CreateIndex
CREATE INDEX "DegreeProgram_universityId_name_idx" ON "DegreeProgram"("universityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DegreeProgram_universityId_code_catalogYear_key" ON "DegreeProgram"("universityId", "code", "catalogYear");

-- CreateIndex
CREATE INDEX "RequirementGroup_programId_sequence_idx" ON "RequirementGroup"("programId", "sequence");

-- CreateIndex
CREATE INDEX "RequirementGroup_parentId_sequence_idx" ON "RequirementGroup"("parentId", "sequence");

-- CreateIndex
CREATE INDEX "RequirementCourse_courseId_idx" ON "RequirementCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementCourse_requirementId_courseId_key" ON "RequirementCourse"("requirementId", "courseId");

-- CreateIndex
CREATE INDEX "Course_universityId_title_idx" ON "Course"("universityId", "title");

-- CreateIndex
CREATE INDEX "Course_departmentId_code_idx" ON "Course"("departmentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Course_universityId_code_key" ON "Course"("universityId", "code");

-- CreateIndex
CREATE INDEX "CoursePrerequisite_courseId_groupNumber_idx" ON "CoursePrerequisite"("courseId", "groupNumber");

-- CreateIndex
CREATE INDEX "CoursePrerequisite_prerequisiteCourseId_idx" ON "CoursePrerequisite"("prerequisiteCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePrerequisite_courseId_prerequisiteCourseId_type_key" ON "CoursePrerequisite"("courseId", "prerequisiteCourseId", "type");

-- CreateIndex
CREATE INDEX "AcademicTerm_universityId_startsOn_idx" ON "AcademicTerm"("universityId", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_universityId_code_key" ON "AcademicTerm"("universityId", "code");

-- CreateIndex
CREATE INDEX "CourseOffering_termId_courseId_idx" ON "CourseOffering"("termId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_courseId_termId_sectionCode_key" ON "CourseOffering"("courseId", "termId", "sectionCode");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegreeProgram" ADD CONSTRAINT "DegreeProgram_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroup" ADD CONSTRAINT "RequirementGroup_programId_fkey" FOREIGN KEY ("programId") REFERENCES "DegreeProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroup" ADD CONSTRAINT "RequirementGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RequirementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCourse" ADD CONSTRAINT "RequirementCourse_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "RequirementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCourse" ADD CONSTRAINT "RequirementCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_prerequisiteCourseId_fkey" FOREIGN KEY ("prerequisiteCourseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
