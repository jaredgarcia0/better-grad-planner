import { useEffect, useRef, useState } from "react";
import { Course, getCurrentUser, logout, User } from "./api/client";
import { CourseSearch } from "./components/CourseSearch";
import { PlanBoard, PlannedCourse } from "./components/PlanBoard";
import { RequirementsPanel } from "./components/RequirementsPanel";
import { SignIn } from "./components/SignIn";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);

  useEffect(() => {
    getCurrentUser()
      .then((result) => setUser(result.data))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    function closeProfileMenu(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      )
        setProfileOpen(false);
    }
    document.addEventListener("mousedown", closeProfileMenu);
    return () => document.removeEventListener("mousedown", closeProfileMenu);
  }, []);

  if (authLoading)
    return (
      <main className="auth-shell">
        <p className="muted">Loading your account…</p>
      </main>
    );
  if (!user && !guestMode)
    return (
      <SignIn
        onAuthenticated={setUser}
        onContinueAsGuest={() => setGuestMode(true)}
      />
    );

  const plannedCourseIds = new Set(plannedCourses.map((course) => course.id));
  const completedCredits = 42;
  const degreeCredits = 120;
  const plannedCredits = plannedCourses.reduce(
    (total, course) => total + course.credits,
    0,
  );
  const unplannedCredits = Math.max(
    degreeCredits - completedCredits - plannedCredits,
    0,
  );
  const initials = user ? user.email.slice(0, 2).toUpperCase() : "G";

  function addCourse(course: Course) {
    if (plannedCourseIds.has(course.id)) return;
    setPlannedCourses((current) => [
      ...current,
      { ...course, termId: "fall-2026" },
    ]);
  }
  function removeCourse(courseId: string) {
    setPlannedCourses((current) =>
      current.filter((course) => course.id !== courseId),
    );
  }
  async function handleSignOut() {
    try {
      if (user) await logout();
    } finally {
      setProfileOpen(false);
      setUser(null);
      setGuestMode(false);
      setPlannedCourses([]);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Better Grad Planner home">
          <span className="brand-mark">B</span>
          <span>Better Grad Planner</span>
        </a>
        <div className="profile-menu" ref={profileMenuRef}>
          <button
            className="profile-button"
            type="button"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            {initials}
          </button>
          {profileOpen && (
            <div className="profile-dropdown" role="menu">
              <div className="profile-summary">
                <strong>{user?.email ?? "Guest student"}</strong>
                <span>{user ? "Authenticated account" : "Guest access"}</span>
              </div>
              <div className="profile-divider" />
              <button
                type="button"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
              >
                Account details <span>→</span>
              </button>
              <button
                className="sign-out-button"
                type="button"
                role="menuitem"
                onClick={handleSignOut}
              >
                Sign out <span>↪</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <main>
        <section className="student-header" id="overview">
          <div>
            <p className="eyebrow">STUDENT DASHBOARD</p>
            <h1>Welcome back.</h1>
            <p className="student-copy">
              {user
                ? `Signed in as ${user.email}. `
                : "You are exploring as a guest. "}
              Here’s your progress toward completing your degree.
            </p>
          </div>
          <div className="degree-progress">
            <span>Computer Science · B.S.</span>
            <strong>
              {completedCredits + plannedCredits}{" "}
              <small>/ {degreeCredits} credits</small>
            </strong>
            <div className="progress-track">
              <i
                style={{
                  width: `${Math.min(((completedCredits + plannedCredits) / degreeCredits) * 100, 100)}%`,
                }}
              />
            </div>
            <em>
              {Math.round(
                ((completedCredits + plannedCredits) / degreeCredits) * 100,
              )}
              % toward completion
            </em>
          </div>
        </section>
        <section className="stats-grid" aria-label="Catalog summary">
          <div className="stat-card">
            <span className="stat-icon green">✓</span>
            <div>
              <strong>{completedCredits}</strong>
              <span>Completed credits</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon blue">◷</span>
            <div>
              <strong>{plannedCredits}</strong>
              <span>Planned credits</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon gold">○</span>
            <div>
              <strong>{unplannedCredits}</strong>
              <span>Unplanned credits</span>
            </div>
          </div>
        </section>
        <PlanBoard courses={plannedCourses} onRemove={removeCourse} />
        <div className="content-grid" id="courses">
          <CourseSearch plannedCourseIds={plannedCourseIds} onAdd={addCourse} />
          <RequirementsPanel />
        </div>
      </main>
      <footer>
        <span>Better Grad Planner</span>
        <span>Built for a clearer path forward.</span>
      </footer>
    </div>
  );
}
