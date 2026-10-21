import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMocks, resetPrismaMocks } from "../support/prisma-mocks.js";
import { testIds } from "../support/test-ids.js";

vi.mock("../../src/lib/prisma.js", () => ({ prisma: prismaMocks }));

import { app } from "../../src/app.js";

const resourceCases = [
  ["universities", prismaMocks.university, { name: "University" }, { name: "Updated" }],
  ["departments", prismaMocks.department, { universityId: testIds.university, code: "CS", name: "Computer Science" }, { name: "Updated" }],
  ["programs", prismaMocks.degreeProgram, { universityId: testIds.university, code: "BS-CS", name: "Computer Science", degreeType: "BACHELOR" }, { name: "Updated" }],
  ["requirements", prismaMocks.requirementGroup, { programId: testIds.program, name: "Core", requirementType: "REQUIRED" }, { name: "Updated" }],
  ["courses", prismaMocks.course, { universityId: testIds.university, code: "CS 101", title: "Introduction", credits: 3 }, { title: "Updated" }],
  ["requirement-courses", prismaMocks.requirementCourse, { requirementId: testIds.requirement, courseId: testIds.course }, { sequence: 2 }],
  ["prerequisites", prismaMocks.coursePrerequisite, { courseId: testIds.course, prerequisiteCourseId: testIds.secondCourse }, { groupNumber: 1 }],
  ["terms", prismaMocks.academicTerm, { universityId: testIds.university, name: "Fall 2026", code: "F26", startsOn: "2026-09-01", endsOn: "2026-12-20" }, { name: "Winter 2027" }],
  ["offerings", prismaMocks.courseOffering, { courseId: testIds.course, termId: testIds.term }, { sectionCode: "002" }],
] as const;

describe("catalog CRUD route coverage", () => {
  beforeEach(() => resetPrismaMocks());

  it.each(resourceCases)("supports list, get, create, update, and delete for %s", async (path, model, createBody, updateBody) => {
    const record = { id: testIds.course };
    model.findMany.mockResolvedValue([record]);
    model.count.mockResolvedValue(1);
    model.findUnique.mockResolvedValue(record);
    model.create.mockResolvedValue(record);
    model.update.mockResolvedValue(record);
    model.delete.mockResolvedValue(record);

    expect((await request(app).get(`/api/${path}`)).status).toBe(200);
    expect((await request(app).get(`/api/${path}/${testIds.course}`)).status).toBe(200);
    expect((await request(app).post(`/api/${path}`).send(createBody)).status).toBe(201);
    expect((await request(app).patch(`/api/${path}/${testIds.course}`).send(updateBody)).status).toBe(200);
    expect((await request(app).delete(`/api/${path}/${testIds.course}`)).status).toBe(204);
  });

  it.each([
    ["/api/universities?q=Test", prismaMocks.university],
    [`/api/departments?q=CS&universityId=${testIds.university}`, prismaMocks.department],
    [`/api/programs?q=CS&universityId=${testIds.university}&degreeType=BACHELOR&catalogYear=2026`, prismaMocks.degreeProgram],
    [`/api/requirements?programId=${testIds.program}&requirementType=REQUIRED&operator=ALL`, prismaMocks.requirementGroup],
    [`/api/requirement-courses?requirementId=${testIds.requirement}&courseId=${testIds.course}`, prismaMocks.requirementCourse],
    [`/api/prerequisites?courseId=${testIds.course}&prerequisiteCourseId=${testIds.secondCourse}&type=COREQUISITE`, prismaMocks.coursePrerequisite],
    [`/api/terms?q=Fall&universityId=${testIds.university}`, prismaMocks.academicTerm],
    [`/api/offerings?courseId=${testIds.course}&termId=${testIds.term}`, prismaMocks.courseOffering],
  ])("applies filters for %s", async (url, model) => {
    model.findMany.mockResolvedValue([]);
    model.count.mockResolvedValue(0);
    const response = await request(app).get(url);
    expect(response.status).toBe(200);
  });

  it.each([
    [`/api/universities/${testIds.university}/departments?q=CS`, prismaMocks.department],
    [`/api/universities/${testIds.university}/programs?q=Computer`, prismaMocks.degreeProgram],
    [`/api/universities/${testIds.university}/courses?q=CS`, prismaMocks.course],
    [`/api/programs/${testIds.program}/requirements?q=Core`, prismaMocks.requirementGroup],
    [`/api/requirements/${testIds.requirement}/courses`, prismaMocks.requirementCourse],
    [`/api/courses/${testIds.course}/prerequisites`, prismaMocks.coursePrerequisite],
    [`/api/courses/${testIds.course}/offerings`, prismaMocks.courseOffering],
    [`/api/terms/${testIds.term}/offerings`, prismaMocks.courseOffering],
  ])("serves catalog relationship endpoint %s", async (url, model) => {
    model.findMany.mockResolvedValue([]);
    model.count.mockResolvedValue(0);
    const response = await request(app).get(url);
    expect(response.status).toBe(200);
  });
});
