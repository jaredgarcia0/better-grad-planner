import {
  getProgram,
  listDegreePlans,
  saveDegreePlanWorkspace,
  type DegreePlan,
  type Program,
} from "./api/client";
import { getPlanPrograms, normalizeGraduationPlan, type GraduationPlan } from "./components/PlanLibrary";
import { normalizeDashboardLayout } from "./dashboardLayout";

export function savedPlansKey(workspaceId: string) {
  return `better-grad-planner:${workspaceId}:plans`;
}

export function loadLocalPlans(workspaceId: string): GraduationPlan[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(savedPlansKey(workspaceId)) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const plan = normalizeGraduationPlan(value as GraduationPlan);
      return plan ? [plan] : [];
    });
  } catch {
    return [];
  }
}

export function saveLocalPlans(workspaceId: string, plans: GraduationPlan[]) {
  // Let storage failures reach the UI so guest changes are never reported saved incorrectly.
  localStorage.setItem(savedPlansKey(workspaceId), JSON.stringify(plans));
}

export function importedLocalPlanIds(workspaceId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`${savedPlansKey(workspaceId)}:imported`) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch { return new Set(); }
}

export function markLocalPlanImported(workspaceId: string, id: string) {
  // The original plan stays in the backup. A receipt avoids offering it again after a cloud deletion.
  try {
    const imported = importedLocalPlanIds(workspaceId);
    imported.add(id);
    localStorage.setItem(`${savedPlansKey(workspaceId)}:imported`, JSON.stringify([...imported]));
  } catch { /* A receipt failure must not turn a successful server save into an error. */ }
}

function legacyTermKey(entry: DegreePlan["courses"][number]) {
  if (entry.termKey) return entry.termKey;
  const match = entry.term?.name?.match(/(fall|winter|spring).*?(\d{4})/i);
  if (match) return `${match[1].toLowerCase()}-${match[2]}`;
  // Empty means unassigned; never invent a semester for a legacy course.
  return "";
}

export async function loadRemotePlans(): Promise<GraduationPlan[]> {
  const first = await listDegreePlans();
  const pages = await Promise.all(
    Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, (_, index) => listDegreePlans(index + 2)),
  );
  const records = [first, ...pages].flatMap((page) => page.data);
  const programs = new Map<string, Promise<Program>>();
  for (const plan of records) {
    if (plan.program) programs.set(plan.program.id, Promise.resolve(plan.program));
  }
  function resolveProgram(id: string) {
    if (!programs.has(id)) programs.set(id, getProgram(id).then((response) => response.data));
    return programs.get(id)!;
  }
  return Promise.all(records.map(async (record) => {
    const refs = record.programs?.length
      ? record.programs
      : [{ programId: record.programId, role: "MAJOR" as const }];
    const selectedPrograms = await Promise.all(refs.map(async (ref) => ({
      program: await resolveProgram(ref.programId), role: ref.role,
    })));
    const plan = normalizeGraduationPlan({
      id: record.id,
      name: record.name,
      programs: selectedPrograms,
      startTerm: record.startTerm ?? "",
      endTerm: record.endTerm ?? "",
      notes: record.notes ?? "",
      requirementLayout: record.requirementLayout ?? undefined,
      dashboardLayout: normalizeDashboardLayout(record.dashboardLayout),
      courses: (record.courses ?? []).map((entry) => ({ ...entry.course, termId: legacyTermKey(entry) })),
    });
    if (!plan) throw new Error(`Unable to load the programs for “${record.name}”.`);
    return plan;
  }));
}

export async function saveRemotePlan(plan: GraduationPlan) {
  const programs = getPlanPrograms(plan);
  await saveDegreePlanWorkspace(plan.id, {
    name: plan.name,
    programId: plan.major.id,
    programs: programs.map(({ program, role }) => ({ programId: program.id, role })),
    startTerm: plan.startTerm,
    endTerm: plan.endTerm,
    notes: plan.notes ?? "",
    requirementLayout: plan.requirementLayout,
    dashboardLayout: normalizeDashboardLayout(plan.dashboardLayout),
    courses: plan.courses.map((course) => ({ courseId: course.id, termKey: course.termId })),
  });
}
