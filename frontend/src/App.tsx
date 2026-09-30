import { useState } from "react";
import { CourseSearch } from "./components/CourseSearch";
import { Course } from "./api/client";
import { PlanBoard, PlannedCourse } from "./components/PlanBoard";
import { RequirementsPanel } from "./components/RequirementsPanel";

export default function App() {
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);
  const plannedCourseIds = new Set(plannedCourses.map((course) => course.id));
  const completedCredits = 42;
  const degreeCredits = 120;
  const plannedCredits = plannedCourses.reduce((total, course) => total + course.credits, 0);
  const unplannedCredits = Math.max(degreeCredits - completedCredits - plannedCredits, 0);

  function addCourse(course: Course) {
    if (plannedCourseIds.has(course.id)) return;
    setPlannedCourses((current) => [...current, { ...course, termId: "fall-2026" }]);
  }

  function removeCourse(courseId: string) {
    setPlannedCourses((current) => current.filter((course) => course.id !== courseId));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Better Grad Planner home"><span className="brand-mark">B</span><span>Better Grad Planner</span></a>
        <button className="profile-button" type="button" aria-label="Open profile">JD</button>
      </header>
      <main>
        <section className="student-header" id="overview">
          <div><p className="eyebrow">STUDENT DASHBOARD</p><h1>Welcome back, Jordan.</h1><p className="student-copy">Here’s your progress toward completing your degree.</p></div>
          <div className="degree-progress"><span>Computer Science · B.S.</span><strong>{completedCredits + plannedCredits} <small>/ {degreeCredits} credits</small></strong><div className="progress-track"><i style={{ width: `${Math.min(((completedCredits + plannedCredits) / degreeCredits) * 100, 100)}%` }} /></div><em>{Math.round(((completedCredits + plannedCredits) / degreeCredits) * 100)}% toward completion</em></div>
        </section>
        <section className="stats-grid" aria-label="Catalog summary">
          <div className="stat-card"><span className="stat-icon green">✓</span><div><strong>{completedCredits}</strong><span>Completed credits</span></div></div>
          <div className="stat-card"><span className="stat-icon blue">◷</span><div><strong>{plannedCredits}</strong><span>Planned credits</span></div></div>
          <div className="stat-card"><span className="stat-icon gold">○</span><div><strong>{unplannedCredits}</strong><span>Unplanned credits</span></div></div>
        </section>
        <PlanBoard courses={plannedCourses} onRemove={removeCourse} />
        <div className="content-grid" id="courses"><CourseSearch plannedCourseIds={plannedCourseIds} onAdd={addCourse} /><RequirementsPanel /></div>
      </main>
      <footer><span>Better Grad Planner</span><span>Built for a clearer path forward.</span></footer>
    </div>
  );
}
