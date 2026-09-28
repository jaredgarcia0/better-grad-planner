// Loads catalog data from prisma/data/*.json into the database. Safe to re-run:
// courses and programs are upserted, and a program's requirement groups are
// rebuilt from scratch each time.
//
// Usage: npm run seed
// Regenerate the data with: npm run scrape:catalog

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Prisma,
  type CourseLevel,
  type DegreeType,
  type PrerequisiteType,
  type RequirementOperator,
  type RequirementType,
} from "../generated/prisma/client.ts";

// .env may live in backend/ or at the repository root.
config({ path: [path.join(__dirname, "../.env"), path.join(__dirname, "../../.env")], quiet: true });

interface CatalogData {
  university: { name: string; shortName?: string; websiteUrl?: string };
  departments: { code: string; name: string }[];
  courses: {
    code: string;
    title: string;
    description?: string;
    credits: number;
    level?: CourseLevel;
    departmentCode?: string;
    prerequisites?: string[][] | null;
    corequisites?: string[][] | null;
  }[];
  programs: {
    code: string;
    name: string;
    degreeType: DegreeType;
    catalogYear?: number;
    description?: string;
    totalCredits?: number;
    requirementGroups: RequirementGroupData[];
  }[];
}

interface RequirementGroupData {
  name: string;
  description?: string;
  requirementType: RequirementType;
  operator: RequirementOperator;
  minCourses?: number;
  maxCourses?: number;
  minCredits?: number;
  maxCredits?: number;
  courses: { code: string; minGrade?: string; creditsOverride?: number }[];
  children: RequirementGroupData[];
}

const DATA_DIR = path.join(__dirname, "data");

async function seedCatalog(tx: Prisma.TransactionClient, data: CatalogData) {
  const university =
    (await tx.university.findFirst({ where: { name: data.university.name } })) ??
    (await tx.university.create({ data: data.university }));
  const universityId = university.id;

  const departmentIds = new Map<string, string>();
  for (const dept of data.departments) {
    const { id } = await tx.department.upsert({
      where: { universityId_code: { universityId, code: dept.code } },
      update: { name: dept.name },
      create: { universityId, ...dept },
    });
    departmentIds.set(dept.code, id);
  }

  const courseIds = new Map<string, string>();
  for (const course of data.courses) {
    const fields = {
      title: course.title,
      description: course.description ?? null,
      credits: course.credits,
      level: course.level ?? null,
      departmentId: (course.departmentCode && departmentIds.get(course.departmentCode)) || null,
    };
    const { id } = await tx.course.upsert({
      where: { universityId_code: { universityId, code: course.code } },
      update: fields,
      create: { universityId, code: course.code, ...fields },
    });
    courseIds.set(course.code, id);
  }

  const courseId = (code: string) => {
    const id = courseIds.get(code);
    if (!id) throw new Error(`Course ${code} is referenced but not defined in the data file`);
    return id;
  };

  // Each OR-group becomes a groupNumber; its courses are alternatives.
  for (const course of data.courses) {
    for (const [type, groups] of [
      ["PREREQUISITE", course.prerequisites],
      ["COREQUISITE", course.corequisites],
    ] as [PrerequisiteType, string[][] | null | undefined][]) {
      if (groups === undefined) continue;
      await tx.coursePrerequisite.deleteMany({ where: { courseId: courseId(course.code), type } });
      await tx.coursePrerequisite.createMany({
        data: (groups ?? []).flatMap((group, groupNumber) =>
          group.map((code) => ({
            courseId: courseId(course.code),
            prerequisiteCourseId: courseId(code),
            type,
            groupNumber,
            isAlternative: group.length > 1,
          })),
        ),
      });
    }
  }

  for (const program of data.programs) {
    const catalogYear = program.catalogYear ?? null;
    const fields = {
      name: program.name,
      degreeType: program.degreeType,
      description: program.description ?? null,
      totalCredits: program.totalCredits ?? null,
    };
    // Prisma can't upsert on a compound unique key containing a nullable
    // column, so look the program up first.
    const existing = await tx.degreeProgram.findFirst({
      where: { universityId, code: program.code, catalogYear },
    });
    const { id: programId } = existing
      ? await tx.degreeProgram.update({ where: { id: existing.id }, data: fields })
      : await tx.degreeProgram.create({ data: { universityId, code: program.code, catalogYear, ...fields } });

    // Children and their course links cascade.
    await tx.requirementGroup.deleteMany({ where: { programId } });

    const createGroup = async (group: RequirementGroupData, sequence: number, parentId: string | null) => {
      const { id } = await tx.requirementGroup.create({
        data: {
          programId,
          parentId,
          sequence,
          name: group.name,
          description: group.description ?? null,
          requirementType: group.requirementType,
          operator: group.operator,
          minCourses: group.minCourses ?? null,
          maxCourses: group.maxCourses ?? null,
          minCredits: group.minCredits ?? null,
          maxCredits: group.maxCredits ?? null,
          courses: {
            create: group.courses.map((c, i) => ({
              courseId: courseId(c.code),
              sequence: i,
              minGrade: c.minGrade ?? null,
              creditsOverride: c.creditsOverride ?? null,
            })),
          },
        },
      });
      for (const [i, child] of group.children.entries()) await createGroup(child, i, id);
    };
    for (const [i, group] of program.requirementGroups.entries()) await createGroup(group, i, null);

    console.log(`  ${program.name} (${program.code}, ${catalogYear ?? "no catalog year"})`);
  }

  console.log(`  ${data.departments.length} departments, ${data.courses.length} courses`);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
      console.log(`Seeding ${file}`);
      const data: CatalogData = JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8"));
      await prisma.$transaction((tx) => seedCatalog(tx, data), { timeout: 120_000, maxWait: 30_000 });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
