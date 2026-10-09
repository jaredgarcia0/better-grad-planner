import { useState } from "react";
import { Course } from "../api/client";

export type PlannedCourse = Course & { termId: string };
type PlanBoardProps = { courses: PlannedCourse[]; onRemove: (courseId: string) => void };
type Term = { id: string; label: string; date: string };
type AcademicYear = { id: string; label: string; terms: Term[] };

const years: AcademicYear[] = [
  { id: "transfer", label: "0 · Transfer credits", terms: [{ id: "transfer", label: "Transfer credits", date: "Before enrollment" }] },
  { id: "2026-2027", label: "2026–2027", terms: [{ id: "fall-2026", label: "Fall 2026", date: "Sep – Dec" }, { id: "winter-2027", label: "Winter 2027", date: "Jan – Apr" }, { id: "spring-2027", label: "Spring 2027", date: "May – Aug" }] },
  { id: "2027-2028", label: "2027–2028", terms: [{ id: "fall-2027", label: "Fall 2027", date: "Sep – Dec" }, { id: "winter-2028", label: "Winter 2028", date: "Jan – Apr" }, { id: "spring-2028", label: "Spring 2028", date: "May – Aug" }] },
  { id: "2028-2029", label: "2028–2029", terms: [{ id: "fall-2028", label: "Fall 2028", date: "Sep – Dec" }, { id: "winter-2029", label: "Winter 2029", date: "Jan – Apr" }, { id: "spring-2029", label: "Spring 2029", date: "May – Aug" }] },
  { id: "2029-2030", label: "2029–2030", terms: [{ id: "fall-2029", label: "Fall 2029", date: "Sep – Dec" }, { id: "winter-2030", label: "Winter 2030", date: "Jan – Apr" }, { id: "spring-2030", label: "Spring 2030", date: "May – Aug" }] },
];

export function PlanBoard({ courses, onRemove }: PlanBoardProps) {
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const totalCredits = courses.reduce((total, course) => total + course.credits, 0);
  const toggleYear = (yearId: string) => setExpandedYears((current) => ({ ...current, [yearId]: !current[yearId] }));

  return <section className="planner-section" id="planner">
    <div className="planner-header"><div><p className="eyebrow">Your roadmap</p><h2>Build your plan</h2><p className="muted">Add courses from the catalog to map out your upcoming semesters.</p></div><div className="plan-total"><strong>{totalCredits}</strong><span>planned credits</span></div></div>
    <div className="year-list">{years.map((year) => <section className="year-section" key={year.id}>
      <button className="year-toggle" type="button" onClick={() => toggleYear(year.id)} aria-expanded={expandedYears[year.id]}><span><strong>{year.label}</strong><small>{year.terms.reduce((total, term) => total + courses.filter((course) => course.termId === term.id).length, 0)} courses planned</small></span><b>{expandedYears[year.id] ? "⌃" : "⌄"}</b></button>
      {expandedYears[year.id] && <div className="term-grid">{year.terms.map((term) => {
        const termCourses = courses.filter((course) => course.termId === term.id);
        const termCredits = termCourses.reduce((total, course) => total + course.credits, 0);
        return <article className="term-card" key={term.id}><div className="term-heading"><div><strong>{term.label}</strong><span>{term.date}</span></div><b>{termCredits} cr</b></div><div className="term-courses">{termCourses.map((course) => <div className="planned-course" key={course.id}><div><strong>{course.code}</strong><span>{course.title}</span></div><button type="button" onClick={() => onRemove(course.id)} aria-label={`Remove ${course.code}`}>×</button></div>)}{termCourses.length === 0 && <div className="empty-term">Add a course here</div>}</div></article>;
      })}</div>}
    </section>)}</div>
  </section>;
}
