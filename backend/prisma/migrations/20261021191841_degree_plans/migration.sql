-- CreateEnum
CREATE TYPE "DegreePlanStatus" AS ENUM ('DRAFT', 'ARCHIVED', 'DECLARED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gradTermId" UUID,
ADD COLUMN     "preferredName" TEXT;

-- CreateTable
CREATE TABLE "DegreePlan" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "status" "DegreePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DegreePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedCourse" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "termId" UUID,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "PlannedCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletedCourse" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "termId" UUID,
    "grade" TEXT,
    "creditsEarned" DOUBLE PRECISION,
    "completedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompletedCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferCourse" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "grade" TEXT,
    "transferSource" TEXT,
    "creditsEarned" DOUBLE PRECISION,
    "completedOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DegreePlan_userId_updatedAt_idx" ON "DegreePlan"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "DegreePlan_programId_idx" ON "DegreePlan"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "DegreePlan_userId_name_key" ON "DegreePlan"("userId", "name");

-- CreateIndex
CREATE INDEX "PlannedCourse_planId_termId_idx" ON "PlannedCourse"("planId", "termId");

-- CreateIndex
CREATE INDEX "PlannedCourse_courseId_idx" ON "PlannedCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedCourse_planId_courseId_key" ON "PlannedCourse"("planId", "courseId");

-- CreateIndex
CREATE INDEX "CompletedCourse_userId_completedOn_idx" ON "CompletedCourse"("userId", "completedOn");

-- CreateIndex
CREATE INDEX "CompletedCourse_courseId_idx" ON "CompletedCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CompletedCourse_userId_courseId_key" ON "CompletedCourse"("userId", "courseId");

-- CreateIndex
CREATE INDEX "TransferCourse_userId_completedOn_idx" ON "TransferCourse"("userId", "completedOn");

-- CreateIndex
CREATE INDEX "TransferCourse_courseId_idx" ON "TransferCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferCourse_userId_courseId_key" ON "TransferCourse"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gradTermId_fkey" FOREIGN KEY ("gradTermId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegreePlan" ADD CONSTRAINT "DegreePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegreePlan" ADD CONSTRAINT "DegreePlan_programId_fkey" FOREIGN KEY ("programId") REFERENCES "DegreeProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DegreePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedCourse" ADD CONSTRAINT "CompletedCourse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedCourse" ADD CONSTRAINT "CompletedCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedCourse" ADD CONSTRAINT "CompletedCourse_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferCourse" ADD CONSTRAINT "TransferCourse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferCourse" ADD CONSTRAINT "TransferCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
