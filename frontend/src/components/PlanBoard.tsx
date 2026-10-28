import { useState } from "react";
import { Course } from "../api/client";
import { buildAcademicYears, getAcademicYearId, listPlanTerms } from "../plannerTerms";

export type PlannedCourse = Course & { termId: string };
type PlanBoardProps = {
  courses: PlannedCourse[];
  onRemove: (courseId: string) => void;
  onMove: (courseId: string, termId: string) => void;
  initialTerm: string;
};

const years = [
  {
    id: "transfer",
    label: "Transfer credits",
    terms: [
      { id: "transfer", label: "Transfer credits", date: "Before enrollment" },
    ],
  },
  ...buildAcademicYears(),
];
const selectableTerms = [
  { id: "transfer", label: "Transfer credits" },
  ...listPlanTerms(),
];

export function PlanBoard({
  courses,
  onRemove,
  onMove,
  initialTerm,
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
            Add courses from the catalog, then choose the semester for each one.
          </p>
        </div>
        <div className="plan-total">
          <strong>{totalCredits}</strong>
          <span>planned credits</span>
        </div>
      </div>
      <div className="year-list">
        {years.map((year) => (
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
                  )} {" "}
                  courses planned
                </small>
              </span>
              <b aria-hidden="true">{expandedYears[year.id] ? "⌃" : "⌄"}</b>
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
                    <article className="term-card" key={term.id}>
                      <div className="term-heading">
                        <div>
                          <strong>{term.label}</strong>
                          <span>{term.date}</span>
                        </div>
                        <b>{termCredits} cr</b>
                      </div>
                      <div className="term-courses">
                        {termCourses.map((course) => (
                          <div className="planned-course" key={course.id}>
                            <div className="planned-course-info">
                              <strong>{course.code}</strong>
                              <span>{course.title}</span>
                            </div>
                            <select
                              className="planned-course-term"
                              aria-label={`Move ${course.code} to another semester`}
                              value={course.termId}
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
                              onClick={() => onRemove(course.id)}
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
