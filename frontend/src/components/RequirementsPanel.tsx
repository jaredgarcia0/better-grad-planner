import { useEffect, useId, useMemo, useState, type DragEvent } from "react";
import {
  Course,
  getMajorGeneralEducation,
  getProgramRequirementTree,
  Program,
  RequirementNode,
} from "../api/client";
import { CourseDetailsModal } from "./CourseDetailsModal";
import { PlanProgram } from "./PlanLibrary";

type RequirementTab = {
  id: string;
  program: Program;
  label: string;
};
type ProgramRequirements = { tab: RequirementTab; groups: RequirementNode[] };
type CourseSelection = {
  course: Course;
  creditsOverride?: number | null;
  minGrade?: string | null;
};

function roleLabel(role: PlanProgram["role"]) {
  return role[0] + role.slice(1).toLowerCase();
}

function groupConstraints(group: RequirementNode) {
  const constraints: string[] = [];
  if (group.minCourses)
    constraints.push(
      `${group.minCourses} course${group.minCourses === 1 ? "" : "s"} required`,
    );
  if (group.minCredits)
    constraints.push(`${group.minCredits} credits required`);
  if (group.maxCourses) constraints.push(`up to ${group.maxCourses} courses`);
  if (group.maxCredits) constraints.push(`up to ${group.maxCredits} credits`);
  return constraints.join(" · ");
}

function groupCourseCount(group: RequirementNode): number {
  return (
    group.courses.length +
    group.children.reduce((total, child) => total + groupCourseCount(child), 0)
  );
}

function startCourseDrag(event: DragEvent<HTMLElement>, course: Course) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("application/bgp-course", JSON.stringify(course));
}

function RequirementGroupView({
  group,
  expandedGroupIds,
  onToggle,
  onSelectCourse,
  level = 0,
}: {
  group: RequirementNode;
  expandedGroupIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectCourse: (
    course: Course,
    creditsOverride?: number | null,
    minGrade?: string | null,
  ) => void;
  level?: number;
}) {
  const isExpanded = expandedGroupIds.has(group.id);
  const contentId = useId();
  const courseCount = groupCourseCount(group);
  const constraints = groupConstraints(group);

  return (
    <section className={`requirement-group requirement-group--level-${level}`}>
      <button
        className="requirement-group-toggle"
        type="button"
        onClick={() => onToggle(group.id)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        <span className="requirement-group-toggle__icon" aria-hidden="true">
          {isExpanded ? "−" : "+"}
        </span>
        <span className="requirement-group-toggle__copy">
          <strong>{group.name}</strong>
          <span>
            {group.requirementType.replaceAll("_", " ")} ·{" "}
            {group.operator === "ANY" ? "Choose any" : "Complete all"}
          </span>
        </span>
        <span className="requirement-group-toggle__summary">
          {constraints ||
            `${courseCount} course${courseCount === 1 ? "" : "s"}`}
        </span>
      </button>
      {isExpanded && (
        <div className="requirement-group-content" id={contentId}>
          {group.description && (
            <p className="requirement-group-description">{group.description}</p>
          )}
          {group.courses.map(({ id, course, creditsOverride, minGrade }) => (
            <div
              className="requirement-item"
              key={id}
              draggable
              role="button"
              tabIndex={0}
              aria-label={`View details for ${course.code}`}
              onClick={() => onSelectCourse(course, creditsOverride, minGrade)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectCourse(course, creditsOverride, minGrade);
                }
              }}
              onDragStart={(event) => startCourseDrag(event, course)}
            >
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
            <RequirementGroupView
              key={child.id}
              group={child}
              expandedGroupIds={expandedGroupIds}
              onToggle={onToggle}
              onSelectCourse={onSelectCourse}
              level={level + 1}
            />
          ))}
          {!group.courses.length && !group.children.length && (
            <p className="requirement-empty muted">
              No course requirements have been listed for this section.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

async function loadProgramRequirements(
  program: PlanProgram,
): Promise<ProgramRequirements> {
  const result = await getProgramRequirementTree(program.program.id);
  return {
    tab: {
      id: `program-${program.program.id}`,
      program: program.program,
      label: roleLabel(program.role),
    },
    groups: result.data,
  };
}

async function loadGeneralEducationRequirements(
  major: PlanProgram,
): Promise<ProgramRequirements> {
  const generalEducation = await getMajorGeneralEducation(major.program.id);
  const result = await getProgramRequirementTree(generalEducation.data.id);
  return {
    tab: {
      id: `general-education-${generalEducation.data.id}`,
      program: generalEducation.data,
      label: "General education",
    },
    groups: result.data,
  };
}

export function RequirementsPanel({
  programs,
  onPlanCourse,
}: {
  programs: PlanProgram[];
  onPlanCourse: (course: Course) => void;
}) {
  const [programRequirements, setProgramRequirements] = useState<
    ProgramRequirements[]
  >([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseSelection | null>(
    null,
  );
  const programKey = programs
    .map(({ program, role }) => `${program.id}:${role}`)
    .join(",");
  const major = programs.find(({ role }) => role === "MAJOR") ?? programs[0];
  const tabs = programRequirements.map(({ tab }) => tab);
  const activeTab =
    tabs.find(({ id }) => id === activeTabId) ?? tabs[0] ?? null;
  const activeRequirements = programRequirements.find(
    ({ tab }) => tab.id === activeTab?.id,
  );

  useEffect(() => {
    setActiveTabId((current) =>
      current?.startsWith("program-") &&
      programs.some(({ program }) => `program-${program.id}` === current)
        ? current
        : (major ? `program-${major.program.id}` : null),
    );
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
      .then(async (result) => {
        if (major) {
          try {
            result.unshift(await loadGeneralEducationRequirements(major));
          } catch {
            // Some catalog programs do not have a GE program assigned.
          }
        }
        if (!cancelled) {
          setProgramRequirements(result);
        }
      })
      .catch((requestError) => {
        if (!cancelled)
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load degree requirements",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programKey]);

  const selectedGroups = useMemo(
    () => activeRequirements?.groups ?? [],
    [activeRequirements],
  );

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
        <div>
          <p className="eyebrow">Degree audit</p>
          <h2>Requirements</h2>
        </div>
        <span className="result-count">
          {programs.length === 1
            ? "Selected program"
            : `${programs.length} programs`}
        </span>
      </div>
      {tabs.length > 0 && (
        <div
          className="program-tabs"
          role="tablist"
          aria-label="Requirement categories"
        >
          {tabs.map((tab) => {
            const selected = tab.id === activeTab?.id;
            return (
              <button
                className="program-tab"
                type="button"
                role="tab"
                key={tab.id}
                id={`program-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`program-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span>{tab.label}</span>
                <strong>{tab.program.name}</strong>
              </button>
            );
          })}
        </div>
      )}
      {loading && <p className="muted">Loading requirements…</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && !activeTab && (
        <p className="muted">Choose a plan to view its requirements.</p>
      )}
      {!loading && !error && activeTab && (
        <div
          className="program-requirements"
          role="tabpanel"
          id={`program-panel-${activeTab.id}`}
          aria-labelledby={`program-tab-${activeTab.id}`}
        >
          {selectedGroups.length ? (
            selectedGroups.map((group) => (
              <RequirementGroupView
                key={group.id}
                group={group}
                expandedGroupIds={expandedGroupIds}
                onToggle={toggleGroup}
                onSelectCourse={(course, creditsOverride, minGrade) =>
                  setSelectedCourse({ course, creditsOverride, minGrade })
                }
              />
            ))
          ) : (
            <p className="requirement-empty muted">
              No requirements found for this program.
            </p>
          )}
        </div>
      )}
      {selectedCourse && (
        <CourseDetailsModal
          course={selectedCourse.course}
          creditsOverride={selectedCourse.creditsOverride}
          minGrade={selectedCourse.minGrade}
          onClose={() => setSelectedCourse(null)}
          onPlan={(course) => {
            setSelectedCourse(null);
            onPlanCourse(course);
          }}
        />
      )}
    </aside>
  );
}
