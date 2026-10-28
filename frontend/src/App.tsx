import { useEffect, useRef, useState } from "react";
import {
  Course,
  getCourse,
  getCurrentUser,
  listCoursePrerequisites,
  logout,
  User,
} from "./api/client";
import { CourseSearch } from "./components/CourseSearch";
import {
  PlanBoard,
  plannerYears,
  PlannedCourse,
} from "./components/PlanBoard";
import { RequirementsPanel } from "./components/RequirementsPanel";
import { SignIn } from "./components/SignIn";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);
  const [courseToPlace, setCourseToPlace] = useState<Course | null>(null);
  const [selectedTermId, setSelectedTermId] = useState("fall-2026");
  const [prerequisiteIssues, setPrerequisiteIssues] = useState<
    Record<string, string[]>
  >({});
  const [issueCourse, setIssueCourse] = useState<PlannedCourse | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((result) => setUser(result.data))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const termOrder = new Map(
      plannerYears.flatMap((year, yearIndex) =>
        year.terms.map((term, termIndex) => [
          term.id,
          yearIndex * 3 + termIndex,
        ]),
      ),
    );
    const termLabels = new Map(
      plannerYears.flatMap((year) =>
        year.terms.map((term) => [term.id, `${year.label} ${term.label}`]),
      ),
    );

    async function checkPrerequisites() {
      const issues = await Promise.all(
        plannedCourses.map(async (course) => {
          const result = await listCoursePrerequisites(course.id);
          const prerequisites = await Promise.all(
            result.data.map(async (prerequisite) => ({
              ...prerequisite,
              course: (await getCourse(prerequisite.prerequisiteCourseId)).data,
            })),
          );
          const currentOrder = termOrder.get(course.termId) ?? Number.MAX_SAFE_INTEGER;
          const scheduledCourses = new Map(
            plannedCourses.map((planned) => [planned.id, planned]),
          );
          const messages: string[] = [];
          const alternativeGroups = new Map<number, typeof prerequisites>();

          for (const prerequisite of prerequisites) {
            if (prerequisite.isAlternative) {
              const group = alternativeGroups.get(prerequisite.groupNumber) ?? [];
              group.push(prerequisite);
              alternativeGroups.set(prerequisite.groupNumber, group);
              continue;
            }
            const scheduled = scheduledCourses.get(
              prerequisite.prerequisiteCourseId,
            );
            const scheduledOrder = scheduled
              ? termOrder.get(scheduled.termId)
              : undefined;
            if (scheduledOrder === undefined || scheduledOrder >= currentOrder) {
              const location = scheduled
                ? `scheduled for ${termLabels.get(scheduled.termId) ?? "another term"}`
                : "not planned";
              messages.push(
                `${prerequisite.course.code} is ${location}; it must come before ${course.code}.`,
              );
            }
          }

          for (const alternatives of alternativeGroups.values()) {
            const satisfied = alternatives.some((prerequisite) => {
              const scheduled = scheduledCourses.get(
                prerequisite.prerequisiteCourseId,
              );
              const scheduledOrder = scheduled
                ? termOrder.get(scheduled.termId)
                : undefined;
              return scheduledOrder !== undefined && scheduledOrder < currentOrder;
            });
            if (!satisfied) {
              const alternativesText = alternatives
                .map((prerequisite) => prerequisite.course.code)
                .join(" or ");
              messages.push(
                `One of ${alternativesText} must be planned before ${course.code}.`,
              );
            }
          }

          return { courseId: course.id, messages, prerequisites };
        }),
      );
      if (!cancelled) {
        const issueMap = new Map(
          issues
            .filter((result) => result.messages.length > 0)
            .map((result) => [result.courseId, result.messages]),
        );
        const scheduledCourses = new Map(
          plannedCourses.map((planned) => [planned.id, planned]),
        );

        // Propagate issues through prerequisite chains. For alternatives, the
        // chain is blocking only when every planned alternative is blocked.
        let changed = true;
        while (changed) {
          changed = false;
          for (const result of issues) {
            const blockedPrerequisites = result.prerequisites.filter(
              (prerequisite) => {
                if (prerequisite.isAlternative) return false;
                const scheduled = scheduledCourses.get(
                  prerequisite.prerequisiteCourseId,
                );
                return Boolean(
                  scheduled && issueMap.has(scheduled.id),
                );
              },
            );
            const alternativeGroups = new Map<number, typeof result.prerequisites>();
            for (const prerequisite of result.prerequisites) {
              if (!prerequisite.isAlternative) continue;
              const group =
                alternativeGroups.get(prerequisite.groupNumber) ?? [];
              group.push(prerequisite);
              alternativeGroups.set(prerequisite.groupNumber, group);
            }
            for (const alternatives of alternativeGroups.values()) {
              const scheduledAlternatives = alternatives.filter((prerequisite) =>
                scheduledCourses.has(prerequisite.prerequisiteCourseId),
              );
              if (
                scheduledAlternatives.length > 0 &&
                scheduledAlternatives.every((prerequisite) =>
                  issueMap.has(prerequisite.prerequisiteCourseId),
                )
              ) {
                blockedPrerequisites.push(...scheduledAlternatives);
              }
            }

            if (blockedPrerequisites.length === 0) continue;
            const messages = issueMap.get(result.courseId) ?? [];
            const hasPropagationMessage = messages.some((message) =>
              message.startsWith("Fix prerequisite issue:"),
            );
            if (!hasPropagationMessage) {
              const blockingDetails = blockedPrerequisites.map((prerequisite) => {
                const blockingCourse = scheduledCourses.get(
                  prerequisite.prerequisiteCourseId,
                );
                const blockingIssues = issueMap.get(
                  prerequisite.prerequisiteCourseId,
                );
                return `${blockingCourse?.code ?? prerequisite.prerequisiteCourseId}: ${blockingIssues?.[0] ?? "its prerequisite is not satisfied"}`;
              });
              issueMap.set(result.courseId, [
                ...messages,
                `Fix prerequisite issue: ${blockingDetails.join("; ")}`,
              ]);
              changed = true;
            }
          }
        }

        setPrerequisiteIssues(Object.fromEntries(issueMap));
      }
    }

    if (plannedCourses.length === 0) {
      setPrerequisiteIssues({});
    } else {
      void checkPrerequisites().catch(() => {
        if (!cancelled) setPrerequisiteIssues({});
      });
    }
    return () => {
      cancelled = true;
    };
  }, [plannedCourses]);

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

  function requestCoursePlacement(course: Course) {
    if (plannedCourseIds.has(course.id)) return;
    setSelectedTermId("fall-2026");
    setCourseToPlace(course);
  }
  function placeCourse(course: Course, termId: string) {
    setPlannedCourses((current) => {
      const existing = current.some((planned) => planned.id === course.id);
      if (existing) {
        return current.map((planned) =>
          planned.id === course.id ? { ...planned, termId } : planned,
        );
      }
      return [...current, { ...course, termId }];
    });
    setCourseToPlace(null);
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
      setCourseToPlace(null);
      setIssueCourse(null);
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
        <PlanBoard
          courses={plannedCourses}
          onRemove={removeCourse}
          onPlaceCourse={placeCourse}
          prerequisiteIssues={prerequisiteIssues}
          onShowPrerequisiteIssue={setIssueCourse}
        />
        <div className="content-grid" id="courses">
          <CourseSearch
            plannedCourseIds={plannedCourseIds}
            onAdd={requestCoursePlacement}
          />
          <RequirementsPanel />
        </div>
      </main>
      {courseToPlace && (
        <div className="placement-overlay" role="presentation">
          <div
            className="placement-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="placement-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Add to your roadmap</p>
                <h2 id="placement-title">Choose a term</h2>
              </div>
              <button
                className="dialog-close"
                type="button"
                aria-label="Close term selection"
                onClick={() => setCourseToPlace(null)}
              >
                ×
              </button>
            </div>
            <p className="placement-course">
              <strong>{courseToPlace.code}</strong> {courseToPlace.title}
            </p>
            <label className="placement-label" htmlFor="placement-term">
              Term
            </label>
            <select
              id="placement-term"
              className="placement-select"
              value={selectedTermId}
              onChange={(event) => setSelectedTermId(event.target.value)}
            >
              {plannerYears.map((year) => (
                <optgroup label={year.label} key={year.id}>
                  {year.terms.map((term) => (
                    <option value={term.id} key={term.id}>
                      {term.label} {year.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="placement-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setCourseToPlace(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => placeCourse(courseToPlace, selectedTermId)}
              >
                Add course
              </button>
            </div>
          </div>
        </div>
      )}
      {issueCourse && (
        <div className="placement-overlay" role="presentation">
          <div
            className="placement-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prerequisite-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Planner warning</p>
                <h2 id="prerequisite-title">Prerequisite issue</h2>
              </div>
              <button
                className="dialog-close"
                type="button"
                aria-label="Close prerequisite details"
                onClick={() => setIssueCourse(null)}
              >
                ×
              </button>
            </div>
            <p className="placement-course">
              <strong>{issueCourse.code}</strong> {issueCourse.title}
            </p>
            <ul className="prerequisite-list">
              {prerequisiteIssues[issueCourse.id]?.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            <div className="placement-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => setIssueCourse(null)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      <footer>
        <span>Better Grad Planner</span>
        <span>Built for a clearer path forward.</span>
      </footer>
    </div>
  );
}
