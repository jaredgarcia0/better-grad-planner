import { useState, type DragEvent } from "react";
import { Course } from "../api/client";
import {
  plannerYears,
  listPlanTerms,
  getAcademicYearId,
} from "../plannerTerms";

export type PlannedCourse = Course & { termId: string };
type PlanBoardProps = {
  courses: PlannedCourse[];
  onRemove: (courseId: string) => void;
  onMove: (courseId: string, termId: string) => void;
  initialTerm: string;
  prerequisiteIssues: Record<string, string[]>;
  onShowPrerequisiteIssue: (course: PlannedCourse) => void;
};

const selectableTerms = [
  { id: "transfer", label: "Transfer credits" },
  ...listPlanTerms(),
];

function readDraggedCourse(event: DragEvent<HTMLElement>): Course | null {
  const payload = event.dataTransfer.getData("application/bgp-course");
  if (!payload) return null;
  try {
    return JSON.parse(payload) as Course;
  } catch {
    return null;
  }
}

export function PlanBoard({
  courses,
  onRemove,
  onMove,
  initialTerm,
  prerequisiteIssues,
  onShowPrerequisiteIssue,
}: PlanBoardProps) {
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>(
    () => ({ [getAcademicYearId(initialTerm)]: true }),
  );
  const totalCredits = courses.reduce(
    (total, course) => total + course.credits,
    0,
  );
  const toggleYear = (yearId: string) =>
    setExpandedYears((current) => ({ ...current, [yearId]: !current[yearId] }));

  return (
    <section className="planner-section" id="planner">
      <div className="planner-header">
        <div>
          <p className="eyebrow">Your roadmap</p>
          <h2>Build your plan</h2>
          <p className="muted">
            Drag courses into a semester, choose a semester from the dropdown,
            or use the add button in the catalog.
          </p>
        </div>
        <div className="plan-total">
          <strong>{totalCredits}</strong>
          <span>planned credits</span>
        </div>
      </div>
      <div className="year-list">
        {plannerYears.map((year) => (
          <section className="year-section" key={year.id}>
            <button
              className="year-toggle"
              type="button"
              onClick={() => toggleYear(year.id)}
              aria-expanded={Boolean(expandedYears[year.id])}
            >
              <span>
                <strong>{year.label}</strong>
                <small>
                  {year.terms.reduce(
                    (total, term) =>
                      total +
                      courses.filter((course) => course.termId === term.id)
                        .length,
                    0,
                  )} {" "} courses planned
                </small>
              </span>
              <b aria-hidden="true">
                {expandedYears[year.id] ? "⌃" : "⌄"}
              </b>
            </button>
            {expandedYears[year.id] && (
              <div className="term-grid">
                {year.terms.map((term) => {
                  const termCourses = courses.filter(
                    (course) => course.termId === term.id,
                  );
                  const termCredits = termCourses.reduce(
                    (total, course) => total + course.credits,
                    0,
                  );
                  return (
                    <article
                      className="term-card"
                      key={term.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const course = readDraggedCourse(event);
                        if (course) onMove(course.id, term.id);
                      }}
                    >
                      <div className="term-heading">
                        <div>
                          <strong>{term.label}</strong>
                          <span>{term.date}</span>
                        </div>
                        <b>{termCredits} cr</b>
                      </div>
                      <div className="term-courses">
                        {termCourses.map((course) => {
                          const hasIssue = prerequisiteIssues[course.id]?.length;
                          return (
                            <div
                              className={`planned-course${hasIssue ? " has-prerequisite-issue" : ""}`}
                              key={course.id}
                              draggable
                              role={hasIssue ? "button" : undefined}
                              tabIndex={hasIssue ? 0 : undefined}
                              onClick={() => {
                                if (hasIssue) onShowPrerequisiteIssue(course);
                              }}
                              onKeyDown={(event) => {
                                if (
                                  hasIssue &&
                                  (event.key === "Enter" || event.key === " ")
                                ) {
                                  event.preventDefault();
                                  onShowPrerequisiteIssue(course);
                                }
                              }}
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData(
                                  "application/bgp-course",
                                  JSON.stringify(course),
                                );
                              }}
                            >
                              <div className="planned-course-info">
                                <strong>{course.code}</strong>
                                <span>{course.title}</span>
                              </div>
                              {hasIssue ? (
                                <span
                                  className="prerequisite-warning"
                                  aria-hidden="true"
                                >
                                  !
                                </span>
                              ) : null}
                              <select
                                className="planned-course-term"
                                aria-label={`Move ${course.code} to another semester`}
                                value={course.termId}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  onMove(course.id, event.target.value)
                                }
                              >
                                {selectableTerms.map((option) => (
                                  <option value={option.id} key={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemove(course.id);
                                }}
                                aria-label={`Remove ${course.code}`}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                        {termCourses.length === 0 && (
                          <div className="empty-term">Add a course here</div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
