import { useMemo, useState } from "react";
import type { AcademicTerm, Course } from "../api/client";

export type PlannedCourse = Course & {
  entryId: string;
  termId: string | null;
  sequence: number;
  notes?: string | null;
};

type PlanBoardProps = {
  courses: PlannedCourse[];
  terms: AcademicTerm[];
  onRemove: (courseEntryId: string) => void;
  onMove: (courseEntryId: string, termId: string | null) => void;
};

type AcademicYear = {
  id: string;
  label: string;
  terms: AcademicTerm[];
};

function formatDateRange(term: AcademicTerm) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(new Date(term.startsOn))} – ${formatter.format(
    new Date(term.endsOn),
  )}`;
}

export function PlanBoard({ courses, terms, onRemove, onMove }: PlanBoardProps) {
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({
    unscheduled: true,
  });

  const sortedTerms = useMemo(
    () =>
      [...terms].sort(
        (left, right) =>
          new Date(left.startsOn).getTime() - new Date(right.startsOn).getTime(),
      ),
    [terms],
  );

  const years = useMemo(() => {
    const grouped = new Map<number, AcademicTerm[]>();
    for (const term of sortedTerms) {
      const year = new Date(term.startsOn).getFullYear();
      grouped.set(year, [...(grouped.get(year) ?? []), term]);
    }
    return Array.from(grouped, ([year, yearTerms]) => ({
      id: String(year),
      label: String(year),
      terms: yearTerms,
    })) satisfies AcademicYear[];
  }, [sortedTerms]);

  const knownTermIds = useMemo(
    () => new Set(sortedTerms.map((term) => term.id)),
    [sortedTerms],
  );
  const unscheduledCourses = courses.filter(
    (course) => !course.termId || !knownTermIds.has(course.termId),
  );
  const totalCredits = courses.reduce(
    (total, course) => total + course.credits,
    0,
  );
  const toggleYear = (yearId: string) =>
    setExpandedYears((current) => ({ ...current, [yearId]: !current[yearId] }));

  function courseCard(course: PlannedCourse) {
    return (
      <div className="planned-course" key={course.entryId}>
        <div className="planned-course__details">
          <strong>{course.code}</strong>
          <span>{course.title}</span>
          <label>
            <span className="sr-only">Term for {course.code}</span>
            <select
              value={course.termId ?? ""}
              onChange={(event) =>
                onMove(course.entryId, event.target.value || null)
              }
            >
              <option value="">Unscheduled</option>
              {sortedTerms.map((term) => (
                <option value={term.id} key={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => onRemove(course.entryId)}
          aria-label={`Remove ${course.code}`}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <section className="planner-section" id="planner">
      <div className="planner-header">
        <div>
          <p className="eyebrow">Your roadmap</p>
          <h2>Build your plan</h2>
          <p className="muted">
            Add courses from the catalog, then choose the term for each course.
          </p>
        </div>
        <div className="plan-total">
          <strong>{totalCredits}</strong>
          <span>planned credits</span>
        </div>
      </div>
      <div className="year-list">
        <section className="year-section">
          <button
            className="year-toggle"
            type="button"
            onClick={() => toggleYear("unscheduled")}
            aria-expanded={expandedYears.unscheduled}
          >
            <span>
              <strong>Unscheduled courses</strong>
              <small>{unscheduledCourses.length} courses waiting for a term</small>
            </span>
            <b>{expandedYears.unscheduled ? "⌃" : "⌄"}</b>
          </button>
          {expandedYears.unscheduled && (
            <div className="term-grid term-grid--unscheduled">
              <article className="term-card">
                <div className="term-heading">
                  <div>
                    <strong>Choose a semester later</strong>
                    <span>Not assigned to a term</span>
                  </div>
                  <b>
                    {unscheduledCourses.reduce(
                      (total, course) => total + course.credits,
                      0,
                    )}{" "}
                    cr
                  </b>
                </div>
                <div className="term-courses">
                  {unscheduledCourses.map(courseCard)}
                  {unscheduledCourses.length === 0 && (
                    <div className="empty-term">All courses have a term</div>
                  )}
                </div>
              </article>
            </div>
          )}
        </section>

        {years.map((year) => {
          const yearCourses = courses.filter((course) =>
            year.terms.some((term) => term.id === course.termId),
          );
          return (
            <section className="year-section" key={year.id}>
              <button
                className="year-toggle"
                type="button"
                onClick={() => toggleYear(year.id)}
                aria-expanded={expandedYears[year.id]}
              >
                <span>
                  <strong>{year.label}</strong>
                  <small>{yearCourses.length} courses planned</small>
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
                      <article className="term-card" key={term.id}>
                        <div className="term-heading">
                          <div>
                            <strong>{term.name}</strong>
                            <span>{formatDateRange(term)}</span>
                          </div>
                          <b>{termCredits} cr</b>
                        </div>
                        <div className="term-courses">
                          {termCourses.map(courseCard)}
                          {termCourses.length === 0 && (
                            <div className="empty-term">No courses yet</div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
