import { useEffect, useId, useMemo, useState } from "react";
import { getProgramRequirementTree, RequirementNode } from "../api/client";
import { PlanProgram } from "./PlanLibrary";

type ProgramRequirements = { program: PlanProgram; groups: RequirementNode[] };

function roleLabel(role: PlanProgram["role"]) {
  return role[0] + role.slice(1).toLowerCase();
}

function groupConstraints(group: RequirementNode) {
  const constraints: string[] = [];
  if (group.minCourses) constraints.push(`${group.minCourses} course${group.minCourses === 1 ? "" : "s"} required`);
  if (group.minCredits) constraints.push(`${group.minCredits} credits required`);
  if (group.maxCourses) constraints.push(`up to ${group.maxCourses} courses`);
  if (group.maxCredits) constraints.push(`up to ${group.maxCredits} credits`);
  return constraints.join(" · ");
}

function groupCourseCount(group: RequirementNode): number {
  return group.courses.length + group.children.reduce((total, child) => total + groupCourseCount(child), 0);
}

function RequirementGroupView({ group, expandedGroupIds, onToggle, level = 0 }: {
  group: RequirementNode;
  expandedGroupIds: Set<string>;
  onToggle: (id: string) => void;
  level?: number;
}) {
  const isExpanded = expandedGroupIds.has(group.id);
  const contentId = useId();
  const courseCount = groupCourseCount(group);
  const constraints = groupConstraints(group);

  return (
    <section className={`requirement-group requirement-group--level-${level}`}>
      <button className="requirement-group-toggle" type="button" onClick={() => onToggle(group.id)} aria-expanded={isExpanded} aria-controls={contentId}>
        <span className="requirement-group-toggle__icon" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
        <span className="requirement-group-toggle__copy">
          <strong>{group.name}</strong>
          <span>{group.requirementType.replaceAll("_", " ")} · {group.operator === "ANY" ? "Choose any" : "Complete all"}</span>
        </span>
        <span className="requirement-group-toggle__summary">{constraints || `${courseCount} course${courseCount === 1 ? "" : "s"}`}</span>
      </button>
      {isExpanded && (
        <div className="requirement-group-content" id={contentId}>
          {group.description && <p className="requirement-group-description">{group.description}</p>}
          {group.courses.map(({ id, course, creditsOverride, minGrade }) => (
            <div className="requirement-item" key={id}>
              <span className="status-dot open" aria-label="Not yet planned" />
              <div>
                <strong>{course.code}</strong>
                <span>{course.title}</span>
                {minGrade && <small>Minimum grade: {minGrade}</small>}
              </div>
              <b>{creditsOverride ?? course.credits} cr</b>
            </div>
          ))}
          {group.children.map((child) => (
            <RequirementGroupView key={child.id} group={child} expandedGroupIds={expandedGroupIds} onToggle={onToggle} level={level + 1} />
          ))}
          {!group.courses.length && !group.children.length && <p className="requirement-empty muted">No course requirements have been listed for this section.</p>}
        </div>
      )}
    </section>
  );
}

async function loadProgramRequirements(program: PlanProgram): Promise<ProgramRequirements> {
  const result = await getProgramRequirementTree(program.program.id);
  return { program, groups: result.data };
}

export function RequirementsPanel({ programs }: { programs: PlanProgram[] }) {
  const [programRequirements, setProgramRequirements] = useState<ProgramRequirements[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const programKey = programs.map(({ program, role }) => `${program.id}:${role}`).join(",");
  const major = programs.find(({ role }) => role === "MAJOR") ?? programs[0];
  const activeProgram = programs.find(({ program }) => program.id === activeProgramId) ?? major;
  const activeRequirements = programRequirements.find(({ program }) => program.program.id === activeProgram?.program.id);

  useEffect(() => {
    setActiveProgramId((current) => programs.some(({ program }) => program.id === current) ? current : (major?.program.id ?? null));
  }, [programKey, major?.program.id]);

  useEffect(() => {
    let cancelled = false;
    if (!programs.length) {
      setProgramRequirements([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(null);
    Promise.all(programs.map(loadProgramRequirements))
      .then((result) => {
        if (!cancelled) {
          setProgramRequirements(result);
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Unable to load degree requirements");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [programKey]);

  const selectedGroups = useMemo(() => activeRequirements?.groups ?? [], [activeRequirements]);

  function toggleGroup(id: string) {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <aside className="card requirements-card">
      <div className="section-heading">
        <div><p className="eyebrow">Degree audit</p><h2>Requirements</h2></div>
        <span className="result-count">{programs.length === 1 ? "Selected program" : `${programs.length} programs`}</span>
      </div>
      {programs.length > 0 && (
        <div className="program-tabs" role="tablist" aria-label="Degree programs">
          {programs.map((entry) => {
            const selected = entry.program.id === activeProgram?.program.id;
            return <button className="program-tab" type="button" role="tab" key={`${entry.role}-${entry.program.id}`} id={`program-tab-${entry.program.id}`} aria-selected={selected} aria-controls={`program-panel-${entry.program.id}`} tabIndex={selected ? 0 : -1} onClick={() => setActiveProgramId(entry.program.id)}>
              <span>{roleLabel(entry.role)}</span><strong>{entry.program.name}</strong>
            </button>;
          })}
        </div>
      )}
      {loading && <p className="muted">Loading requirements…</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && !activeProgram && <p className="muted">Choose a plan to view its requirements.</p>}
      {!loading && !error && activeProgram && (
        <div className="program-requirements" role="tabpanel" id={`program-panel-${activeProgram.program.id}`} aria-labelledby={`program-tab-${activeProgram.program.id}`}>
          {selectedGroups.length ? selectedGroups.map((group) => <RequirementGroupView key={group.id} group={group} expandedGroupIds={expandedGroupIds} onToggle={toggleGroup} />) : <p className="requirement-empty muted">No requirements found for this program.</p>}
        </div>
      )}
    </aside>
  );
}
