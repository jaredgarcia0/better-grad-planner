// Loads catalog data from prisma/data/*.json into the database. Safe to re-run:
// courses and programs are upserted, and a program's requirement groups are
// rebuilt from scratch each time. Rows are written in batches so a full catalog
// (thousands of courses) loads in a handful of round trips.
//
// Usage: npm run seed
// Regenerate the data with: npm run scrape:catalog

import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// .env may live in backend/ or at the repository root.
config({ path: [path.join(currentDir, "../.env"), path.join(currentDir, "../../.env")], quiet: true });

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

const DATA_DIR = path.join(currentDir, "data");
// Keeps each statement well under PostgreSQL's 65,535 bind-parameter limit.
const BATCH_SIZE = 500;

function chunks<T>(rows: T[], size = BATCH_SIZE): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) result.push(rows.slice(i, i + size));
  return result;
}

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

  // Prisma has no bulk upsert, so courses use INSERT ... ON CONFLICT directly.
  const courseIds = new Map<string, string>();
  for (const batch of chunks(data.courses)) {
    const rows = batch.map((c) => {
      const departmentId = (c.departmentCode && departmentIds.get(c.departmentCode)) || null;
      return Prisma.sql`(${randomUUID()}::uuid, ${universityId}::uuid, ${departmentId}::uuid, ${c.code},
        ${c.title}, ${c.description ?? null}, ${c.credits}::double precision, ${c.level ?? null}::"CourseLevel")`;
    });
    const upserted = await tx.$queryRaw<{ id: string; code: string }[]>`
      INSERT INTO "Course" ("id", "universityId", "departmentId", "code", "title", "description", "credits", "level")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("universityId", "code") DO UPDATE SET
        "departmentId" = EXCLUDED."departmentId",
        "title" = EXCLUDED."title",
        "description" = EXCLUDED."description",
        "credits" = EXCLUDED."credits",
        "level" = EXCLUDED."level"
      RETURNING "id", "code"`;
    for (const { id, code } of upserted) courseIds.set(code, id);
  }

  const courseId = (code: string) => {
    const id = courseIds.get(code);
    if (!id) throw new Error(`Course ${code} is referenced but not defined in the data file`);
    return id;
  };

  // Each OR-group becomes a groupNumber; its courses are alternatives. Courses
  // whose rules are undefined in the data keep their existing rows.
  for (const [type, field] of [
    ["PREREQUISITE", "prerequisites"],
    ["COREQUISITE", "corequisites"],
  ] as [PrerequisiteType, "prerequisites" | "corequisites"][]) {
    const withRules = data.courses.filter((c) => c[field] !== undefined);
    for (const batch of chunks(withRules)) {
      await tx.coursePrerequisite.deleteMany({ where: { type, courseId: { in: batch.map((c) => courseId(c.code)) } } });
    }
    const rows = withRules.flatMap((course) =>
      (course[field] ?? []).flatMap((group, groupNumber) =>
        group.map((code) => ({
          courseId: courseId(course.code),
          prerequisiteCourseId: courseId(code),
          type,
          groupNumber,
          isAlternative: group.length > 1,
        })),
      ),
    );
    for (const batch of chunks(rows)) await tx.coursePrerequisite.createMany({ data: batch });
  }

  // The (universityId, code, catalogYear) unique key can't catch duplicates
  // when catalogYear is NULL, so every program must have one.
  for (const program of data.programs) {
    if (program.catalogYear == null) throw new Error(`Program ${program.code} has no catalogYear`);
  }
  const programIds = new Map<string, string>();
  for (const batch of chunks(data.programs)) {
    const rows = batch.map(
      (p) => Prisma.sql`(${randomUUID()}::uuid, ${universityId}::uuid, ${p.code}, ${p.name},
        ${p.degreeType}::"DegreeType", ${p.catalogYear}::int, ${p.description ?? null},
        ${p.totalCredits ?? null}::double precision, CURRENT_TIMESTAMP)`,
    );
    const upserted = await tx.$queryRaw<{ id: string; code: string }[]>`
      INSERT INTO "DegreeProgram" ("id", "universityId", "code", "name", "degreeType", "catalogYear", "description", "totalCredits", "updatedAt")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("universityId", "code", "catalogYear") DO UPDATE SET
        "name" = EXCLUDED."name",
        "degreeType" = EXCLUDED."degreeType",
        "description" = EXCLUDED."description",
        "totalCredits" = EXCLUDED."totalCredits",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "id", "code"`;
    for (const { id, code } of upserted) programIds.set(code, id);
  }

  // Requirement groups are rebuilt; children and their course links cascade.
  for (const batch of chunks([...programIds.values()])) {
    await tx.requirementGroup.deleteMany({ where: { programId: { in: batch } } });
  }

  // IDs are generated here so the whole tree can be inserted with createMany.
  // Groups are listed parents-first, so a parent is always inserted in the
  // same or an earlier batch than its children.
  const groupRows: Prisma.RequirementGroupCreateManyInput[] = [];
  const courseRows: Prisma.RequirementCourseCreateManyInput[] = [];
  for (const program of data.programs) {
    const programId = programIds.get(program.code)!;
    let level = program.requirementGroups.map((group, sequence) => ({ group, sequence, parentId: null as string | null }));
    while (level.length) {
      const next: typeof level = [];
      for (const { group, sequence, parentId } of level) {
        const id = randomUUID();
        groupRows.push({
          id,
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
        });
        group.courses.forEach((c, i) =>
          courseRows.push({
            requirementId: id,
            courseId: courseId(c.code),
            sequence: i,
            minGrade: c.minGrade ?? null,
            creditsOverride: c.creditsOverride ?? null,
          }),
        );
        group.children.forEach((child, i) => next.push({ group: child, sequence: i, parentId: id }));
      }
      level = next;
    }
  }
  for (const batch of chunks(groupRows)) await tx.requirementGroup.createMany({ data: batch });
  for (const batch of chunks(courseRows)) await tx.requirementCourse.createMany({ data: batch });

  console.log(
    `  ${data.departments.length} departments, ${data.courses.length} courses, ${data.programs.length} programs, ` +
      `${groupRows.length} requirement groups`,
  );
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
      console.log(`Seeding ${file}`);
      const data: CatalogData = JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8"));
      await prisma.$transaction((tx) => seedCatalog(tx, data), { timeout: 300_000, maxWait: 30_000 });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
