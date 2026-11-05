import { useEffect, useId, useMemo, useState, type DragEvent } from "react";
import {
  Course,
  getCourse,
  getProgramRequirementTree,
  RequirementNode,
} from "../api/client";
import { PlanProgram } from "./PlanLibrary";

type ProgramRequirements = { program: PlanProgram; groups: RequirementNode[] };

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
  onSelectCourse: (course: Course) => void;
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
              onClick={() => onSelectCourse(course)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectCourse(course);
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
  return { program, groups: result.data };
}

export function RequirementsPanel({ programs }: { programs: PlanProgram[] }) {
  const [programRequirements, setProgramRequirements] = useState<
    ProgramRequirements[]
  >([]);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseDetails, setCourseDetails] = useState<Course | null>(null);
  const [courseDetailsLoading, setCourseDetailsLoading] = useState(false);
  const programKey = programs
    .map(({ program, role }) => `${program.id}:${role}`)
    .join(",");
  const major = programs.find(({ role }) => role === "MAJOR") ?? programs[0];
  const activeProgram =
    programs.find(({ program }) => program.id === activeProgramId) ?? major;
  const activeRequirements = programRequirements.find(
    ({ program }) => program.program.id === activeProgram?.program.id,
  );

  useEffect(() => {
    setActiveProgramId((current) =>
      programs.some(({ program }) => program.id === current)
        ? current
        : (major?.program.id ?? null),
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
      .then((result) => {
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

  useEffect(() => {
    let cancelled = false;
    if (!selectedCourse) {
      setCourseDetails(null);
      setCourseDetailsLoading(false);
      return undefined;
    }
    setCourseDetails(selectedCourse);
    setCourseDetailsLoading(true);
    getCourse(selectedCourse.id)
      .then((result) => {
        if (!cancelled) setCourseDetails(result.data);
      })
      .catch(() => {
        // The requirement's embedded course summary remains useful offline.
      })
      .finally(() => {
        if (!cancelled) setCourseDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCourse]);

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
      {programs.length > 0 && (
        <div
          className="program-tabs"
          role="tablist"
          aria-label="Degree programs"
        >
          {programs.map((entry) => {
            const selected = entry.program.id === activeProgram?.program.id;
            return (
              <button
                className="program-tab"
                type="button"
                role="tab"
                key={`${entry.role}-${entry.program.id}`}
                id={`program-tab-${entry.program.id}`}
                aria-selected={selected}
                aria-controls={`program-panel-${entry.program.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveProgramId(entry.program.id)}
              >
                <span>{roleLabel(entry.role)}</span>
                <strong>{entry.program.name}</strong>
              </button>
            );
          })}
        </div>
      )}
      {loading && <p className="muted">Loading requirements…</p>}
      {error && <p className="error-message">{error}</p>}
      {!loading && !error && !activeProgram && (
        <p className="muted">Choose a plan to view its requirements.</p>
      )}
      {!loading && !error && activeProgram && (
        <div
          className="program-requirements"
          role="tabpanel"
          id={`program-panel-${activeProgram.program.id}`}
          aria-labelledby={`program-tab-${activeProgram.program.id}`}
        >
          {selectedGroups.length ? (
            selectedGroups.map((group) => (
              <RequirementGroupView
                key={group.id}
                group={group}
                expandedGroupIds={expandedGroupIds}
                onToggle={toggleGroup}
                onSelectCourse={setSelectedCourse}
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
        <div className="placement-overlay" role="presentation">
          <div
            className="placement-dialog course-details-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-details-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Course information</p>
                <h2 id="course-details-title">
                  {courseDetails?.code ?? selectedCourse.code}
                </h2>
              </div>
              <button
                className="dialog-close"
                type="button"
                aria-label="Close course information"
                onClick={() => setSelectedCourse(null)}
              >
                ×
              </button>
            </div>
            <p className="placement-course">
              <strong>{courseDetails?.title ?? selectedCourse.title}</strong>
            </p>
            <dl className="course-details-list">
              <div>
                <dt>Credits</dt>
                <dd>{courseDetails?.credits ?? selectedCourse.credits}</dd>
              </div>
              {courseDetails?.department?.name && (
                <div>
                  <dt>Department</dt>
                  <dd>{courseDetails.department.name}</dd>
                </div>
              )}
              {courseDetails?.level && (
                <div>
                  <dt>Level</dt>
                  <dd>{courseDetails.level}</dd>
                </div>
              )}
            </dl>
            {courseDetailsLoading && <p className="muted">Loading details…</p>}
            {courseDetails?.description && (
              <p className="course-details-description">
                {courseDetails.description}
              </p>
            )}
            <div className="placement-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => setSelectedCourse(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
