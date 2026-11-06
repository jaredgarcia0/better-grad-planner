import { describe, expect, it } from "vitest";
import { dashboardColumnCounts, dashboardLayoutSchema, planWorkspaceSchema } from "../../src/schemas/plan-workspace.schemas.js";
import { testIds } from "../support/test-ids.js";

const column = { id: "column", widget: "planner" };
const row = { id: "row", layout: "full", columns: [column] };
const layout = { version: 1, rows: [row] };
export const snapshotFixture = () => ({
  name: "My plan",
  programId: testIds.program,
  programs: [{ programId: testIds.program, role: "MAJOR" }],
  startTerm: "fall-2026",
  endTerm: "spring-2027",
  notes: "",
  dashboardLayout: layout,
  courses: [{ courseId: testIds.course, termKey: "fall-2026" }],
});

describe("dashboard layout validation", () => {
  it.each(Object.entries(dashboardColumnCounts))("accepts the %s preset with %i columns", (preset, count) => {
    expect(dashboardLayoutSchema.safeParse({ version: 1, rows: [{
      id: "row", layout: preset,
      columns: Array.from({ length: count }, (_, i) => ({ id: `col-${i}`, widget: null })),
    }] }).success).toBe(true);
  });

  it("accepts empty state and bounded IDs/rows including 80 distinct columns", () => {
    expect(dashboardLayoutSchema.safeParse({ version: 1, rows: [] }).success).toBe(true);
    expect(dashboardLayoutSchema.safeParse({ version: 1, rows: Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`.padEnd(80, "x"), layout: "quarters",
      columns: Array.from({ length: 4 }, (_, j) => ({ id: `col-${i}-${j}`, widget: null })),
    })) }).success).toBe(true);
  });

  it.each([
    { ...layout, version: 2 },
    { ...layout, unexpected: true },
    { ...layout, rows: Array.from({ length: 21 }, (_, i) => ({ ...row, id: `row-${i}` })) },
    { ...layout, rows: [{ ...row, unexpected: true }] },
    { ...layout, rows: [{ ...row, id: "" }] },
    { ...layout, rows: [{ ...row, id: " " }] },
    { ...layout, rows: [{ ...row, id: "x".repeat(81) }] },
    { ...layout, rows: [{ ...row, layout: "unknown" }] },
    { ...layout, rows: [{ ...row, layout: "halves" }] },
    { ...layout, rows: [{ ...row, columns: [] }] },
    { ...layout, rows: [{ ...row, columns: [{ ...column, id: "row" }] }] },
    { ...layout, rows: [{ ...row, columns: [{ ...column, widget: "unknown" }] }] },
    { ...layout, rows: [{ ...row, columns: [{ ...column, unexpected: true }] }] },
    { ...layout, rows: [{ ...row, columns: [{ id: "column" }] }] },
    { ...layout, rows: [row, { ...row, id: "row2", columns: [{ ...column, id: "col2" }] }] },
    { ...layout, rows: [row, { ...row, id: "column", columns: [{ id: "col2", widget: null }] }] },
    { ...layout, rows: [row, { ...row, id: "row2", columns: [{ ...column, widget: null }] }] },
  ])("rejects invalid layout %#", (invalid) => {
    expect(dashboardLayoutSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("workspace snapshot validation", () => {
  it("accepts blank terms, notes and courses and null reset", () => {
    expect(planWorkspaceSchema.parse({ ...snapshotFixture(), startTerm: "", endTerm: "", notes: "", dashboardLayout: null, courses: [] }).notes).toBe("");
    expect(planWorkspaceSchema.safeParse({ ...snapshotFixture(), courses: [{ courseId: testIds.course, termKey: "" }] }).success).toBe(true);
    expect(planWorkspaceSchema.safeParse({ ...snapshotFixture(), startTerm: "winter-2026", endTerm: "fall-2026" }).success).toBe(true);
  });

  it.each([
    { name: "x".repeat(81) }, { name: "  " }, { notes: null },
    { programs: [] },
    { programs: [{ programId: testIds.program, role: "MINOR" }] },
    { programs: [{ programId: testIds.secondCourse, role: "MAJOR" }] },
    { programs: [{ programId: testIds.program, role: "MAJOR" }, { programId: testIds.secondCourse, role: "MAJOR" }] },
    { programs: [{ programId: testIds.program, role: "MAJOR" }, { programId: testIds.program.toUpperCase(), role: "MINOR" }] },
    { startTerm: "summer-2026" }, { endTerm: "fall-26" }, { endTerm: "spring-2026" },
    { courses: [{ courseId: testIds.course, termKey: "fall-2026\n" }] },
    { courses: [{ courseId: testIds.course, termKey: null }] },
    { courses: [{ courseId: "bad-id", termKey: "" }] },
    { courses: [{ courseId: testIds.course, termKey: "" }, { courseId: testIds.course, termKey: "spring-2027" }] },
    { courses: Array.from({ length: 501 }, () => ({ courseId: testIds.course, termKey: "" })) },
    { dashboardLayout: undefined }, { courses: undefined }, { startTerm: undefined },
    { userId: testIds.secondUser }, { requirementLayout: ["unknown"] },
  ])("rejects invalid snapshot %#", (invalid) => {
    expect(planWorkspaceSchema.safeParse({ ...snapshotFixture(), ...invalid }).success).toBe(false);
  });

  it("accepts exactly 500 distinct courses", () => {
    const courses = Array.from({ length: 500 }, (_, i) => ({
      courseId: `33333333-3333-4333-8333-${String(i).padStart(12, "0")}`, termKey: "",
    }));
    expect(planWorkspaceSchema.safeParse({ ...snapshotFixture(), name: "x".repeat(80), courses }).success).toBe(true);
  });
});
