import { z } from "zod";
import { requiredStringSchema, uuidSchema } from "../utils/parse.js";

export const dashboardColumnCounts = {
  full: 1,
  halves: 2,
  thirds: 3,
  "third-two-thirds": 2,
  "two-thirds-third": 2,
  "three-quarters-quarter": 2,
  "quarter-three-quarters": 2,
  "quarter-half-quarter": 3,
  "quarter-quarter-half": 3,
  "half-quarter-quarter": 3,
  quarters: 4,
} as const;

const dashboardIdSchema = z.string().min(1).max(80).refine(
  (value) => value.trim().length > 0,
  "IDs must not be blank.",
);
const widgetSchema = z.enum([
  "planner", "requirements", "course-search", "notes", "progress", "prerequisites",
]);

export const dashboardLayoutSchema = z.strictObject({
  version: z.literal(1),
  rows: z.array(z.strictObject({
    id: dashboardIdSchema,
    layout: z.enum(Object.keys(dashboardColumnCounts) as [
      keyof typeof dashboardColumnCounts, ...(keyof typeof dashboardColumnCounts)[],
    ]),
    columns: z.array(z.strictObject({
      id: dashboardIdSchema,
      widget: widgetSchema.nullable(),
    })).min(1).max(4),
  })).max(20),
}).superRefine(({ rows }, context) => {
  const ids = new Set<string>();
  const widgets = new Set<string>();
  const uniqueId = (id: string, path: (string | number)[]) => {
    if (ids.has(id)) context.addIssue({ code: "custom", path, message: "Dashboard IDs must be globally unique." });
    ids.add(id);
  };
  rows.forEach((row, index) => {
    uniqueId(row.id, ["rows", index, "id"]);
    if (row.columns.length !== dashboardColumnCounts[row.layout]) {
      context.addIssue({ code: "custom", path: ["rows", index, "columns"], message: "Column count must match the layout preset." });
    }
    row.columns.forEach((column, columnIndex) => {
      uniqueId(column.id, ["rows", index, "columns", columnIndex, "id"]);
      if (column.widget !== null) {
        if (widgets.has(column.widget)) context.addIssue({ code: "custom", path: ["rows", index, "columns", columnIndex, "widget"], message: "Each widget may appear only once." });
        widgets.add(column.widget);
      }
    });
  });
});

export const requirementLayoutSchema = z.array(z.enum(["major", "general", "electives"])).max(3);
export const termKeySchema = z.string().regex(/^(?:|(fall|winter|spring)-\d{4})$/)
  .refine((value) => value === value.trim(), "Terms must not contain surrounding whitespace.");

// Calendar order within each year, independent of lexical season ordering.
function termOrder(term: string) {
  const [season, year] = term.split("-");
  return Number(year) * 3 + ({ winter: 0, spring: 1, fall: 2 }[season!] ?? 0);
}

export const planWorkspaceSchema = z.strictObject({
  name: requiredStringSchema.max(80),
  programId: uuidSchema,
  programs: z.array(z.strictObject({
    programId: uuidSchema,
    role: z.enum(["MAJOR", "MINOR", "CERTIFICATE"]),
  })).min(1).max(500),
  startTerm: termKeySchema,
  endTerm: termKeySchema,
  notes: z.string(),
  dashboardLayout: dashboardLayoutSchema.nullable(),
  requirementLayout: requirementLayoutSchema.optional(),
  courses: z.array(z.strictObject({ courseId: uuidSchema, termKey: termKeySchema })).max(500),
}).superRefine((value, context) => {
  const programIds = value.programs.map((program) => program.programId.toLowerCase());
  if (new Set(programIds).size !== programIds.length) {
    context.addIssue({ code: "custom", path: ["programs"], message: "Program references must not be duplicated." });
  }
  const majors = value.programs.filter((program) => program.role === "MAJOR");
  if (majors.length !== 1 || majors[0]!.programId.toLowerCase() !== value.programId.toLowerCase()) {
    context.addIssue({ code: "custom", path: ["programs"], message: "Exactly one MAJOR must match programId." });
  }
  if (value.startTerm && value.endTerm && termOrder(value.startTerm) > termOrder(value.endTerm)) {
    context.addIssue({ code: "custom", path: ["endTerm"], message: "endTerm must be on or after startTerm." });
  }
  const courseIds = value.courses.map((course) => course.courseId.toLowerCase());
  if (new Set(courseIds).size !== courseIds.length) {
    context.addIssue({ code: "custom", path: ["courses"], message: "Courses must not be duplicated." });
  }
});

export type PlanWorkspace = z.infer<typeof planWorkspaceSchema>;
