import { useState, type DragEvent } from "react";
import { Course } from "../api/client";

export type PlannedCourse = Course & { termId: string };
type PlanBoardProps = {
  courses: PlannedCourse[];
  onRemove: (courseId: string) => void;
  onPlaceCourse: (course: Course, termId: string) => void;
  prerequisiteIssues: Record<string, string[]>;
  onShowPrerequisiteIssue: (course: PlannedCourse) => void;
};
export type Term = { id: string; label: string; date: string };
type AcademicYear = { id: string; label: string; terms: Term[] };

export const plannerYears: AcademicYear[] = [
  {
    id: "transfer",
    label: "0 · Transfer credits",
    terms: [
      { id: "transfer", label: "Transfer credits", date: "Before enrollment" },
    ],
  },
  {
    id: "2026",
    label: "2026",
    terms: [
      { id: "winter-2026", label: "Winter", date: "Jan – Apr" },
      { id: "spring-2026", label: "Spring", date: "May – Aug" },
      { id: "fall-2026", label: "Fall", date: "Sep – Dec" },
    ],
  },
  {
    id: "2027",
    label: "2027",
    terms: [
      { id: "winter-2027", label: "Winter", date: "Jan – Apr" },
      { id: "spring-2027", label: "Spring", date: "May – Aug" },
      { id: "fall-2027", label: "Fall", date: "Sep – Dec" },
    ],
  },
  {
    id: "2028",
    label: "2028",
    terms: [
      { id: "winter-2028", label: "Winter", date: "Jan – Apr" },
      { id: "spring-2028", label: "Spring", date: "May – Aug" },
      { id: "fall-2028", label: "Fall", date: "Sep – Dec" },
    ],
  },
  {
    id: "2029",
    label: "2029",
    terms: [
      { id: "winter-2029", label: "Winter", date: "Jan – Apr" },
      { id: "spring-2029", label: "Spring", date: "May – Aug" },
      { id: "fall-2029", label: "Fall", date: "Sep – Dec" },
    ],
  },
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
  onPlaceCourse,
  prerequisiteIssues,
  onShowPrerequisiteIssue,
}: PlanBoardProps) {
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>(
    {},
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
            Add courses from the catalog to map out your upcoming semesters.
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
              aria-expanded={expandedYears[year.id]}
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
                  )}{" "}
                  courses planned
                </small>
              </span>
              <b>{expandedYears[year.id] ? "⌃" : "⌄"}</b>
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
                        if (course) onPlaceCourse(course, term.id);
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
                        {termCourses.map((course) => (
                          <div
                            className={`planned-course${prerequisiteIssues[course.id]?.length ? " has-prerequisite-issue" : ""}`}
                            key={course.id}
                            draggable
                            role={
                              prerequisiteIssues[course.id]?.length
                                ? "button"
                                : undefined
                            }
                            tabIndex={
                              prerequisiteIssues[course.id]?.length ? 0 : undefined
                            }
                            onClick={() => {
                              if (prerequisiteIssues[course.id]?.length) {
                                onShowPrerequisiteIssue(course);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (
                                prerequisiteIssues[course.id]?.length &&
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
                            <div>
                              <strong>{course.code}</strong>
                              <span>{course.title}</span>
                            </div>
                            {prerequisiteIssues[course.id]?.length ? (
                              <span className="prerequisite-warning" aria-hidden="true">
                                !
                              </span>
                            ) : null}
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
                        ))}
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
