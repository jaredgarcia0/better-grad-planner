import { useEffect, useRef, useState } from "react";
import { Course, getCurrentUser, logout, Program, User } from "./api/client";
import { CourseSearch } from "./components/CourseSearch";
import {
  GraduationPlan,
  PlanLibrary,
  PlanSetup,
} from "./components/PlanLibrary";
import { PlanBoard } from "./components/PlanBoard";
import { RequirementsPanel } from "./components/RequirementsPanel";
import { SignIn } from "./components/SignIn";

function savedPlansKey(workspaceId: string) {
  return `better-grad-planner:${workspaceId}:plans`;
}

function loadPlans(workspaceId: string): GraduationPlan[] {
  try {
    const saved = localStorage.getItem(savedPlansKey(workspaceId));
    if (!saved) return [];
    const parsed = JSON.parse(saved) as unknown;
    return Array.isArray(parsed) ? (parsed as GraduationPlan[]) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [plans, setPlans] = useState<GraduationPlan[]>([]);
  const [plansWorkspace, setPlansWorkspace] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<GraduationPlan | null>(null);

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
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", closeProfileMenu);
    return () => document.removeEventListener("mousedown", closeProfileMenu);
  }, []);

  const workspaceId = user ? `user-${user.id}` : guestMode ? "guest" : null;

  useEffect(() => {
    if (authLoading || !workspaceId) return;
    setPlans(loadPlans(workspaceId));
    setPlansWorkspace(workspaceId);
    setSelectedPlanId(null);
    setSetupOpen(false);
    setEditingPlan(null);
  }, [authLoading, workspaceId]);

  useEffect(() => {
    if (!workspaceId || plansWorkspace !== workspaceId) return;
    try {
      localStorage.setItem(savedPlansKey(workspaceId), JSON.stringify(plans));
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, [plans, plansWorkspace, workspaceId]);

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

  const initials = user ? user.email.slice(0, 2).toUpperCase() : "G";
  const activePlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const plannedCourseIds = new Set(
    activePlan?.courses.map((course) => course.id) ?? [],
  );

  function handleSavePlan(plan: GraduationPlan) {
    setPlans((current) => {
      const existing = current.some((item) => item.id === plan.id);
      return existing
        ? current.map((item) => (item.id === plan.id ? plan : item))
        : [...current, plan];
    });
    setSelectedPlanId(plan.id);
    setSetupOpen(false);
    setEditingPlan(null);
  }

  function updateActivePlanCourses(
    update: (courses: GraduationPlan["courses"]) => GraduationPlan["courses"],
  ) {
    if (!activePlan) return;
    setPlans((current) =>
      current.map((plan) =>
        plan.id === activePlan.id
          ? { ...plan, courses: update(plan.courses) }
          : plan,
      ),
    );
  }

  function addCourse(course: Course) {
    if (plannedCourseIds.has(course.id)) return;
    updateActivePlanCourses((current) => [
      ...current,
      { ...course, termId: activePlan?.startTerm || "fall-2026" },
    ]);
  }

  function removeCourse(courseId: string) {
    updateActivePlanCourses((current) =>
      current.filter((course) => course.id !== courseId),
    );
  }

  function moveCourse(courseId: string, termId: string) {
    updateActivePlanCourses((current) =>
      current.map((course) =>
        course.id === courseId ? { ...course, termId } : course,
      ),
    );
  }

  async function handleSignOut() {
    try {
      if (user) await logout();
    } finally {
      setProfileOpen(false);
      setUser(null);
      setGuestMode(false);
      setPlans([]);
      setPlansWorkspace(null);
      setSelectedPlanId(null);
      setSetupOpen(false);
      setEditingPlan(null);
    }
  }

  const activePrograms: Program[] = activePlan
    ? [activePlan.major, ...(activePlan.minor ? [activePlan.minor] : [])]
    : [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Better Grad Planner home">
          <span className="brand-mark">B</span>
          <span>Better Grad Planner</span>
        </a>
        {activePlan && !setupOpen && (
          <button
            className="header-plans-link"
            type="button"
            onClick={() => setSelectedPlanId(null)}
          >
            ← All plans
          </button>
        )}
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
        {setupOpen ? (
          <PlanSetup
            key={editingPlan?.id ?? "new-plan"}
            initialPlan={editingPlan}
            onCancel={() => {
              setSetupOpen(false);
              setEditingPlan(null);
            }}
            onSave={handleSavePlan}
          />
        ) : activePlan ? (
          <>
            <section className="plan-overview">
              <div className="plan-overview-copy">
                <p className="eyebrow">YOUR GRADUATION PLAN</p>
                <h1>{activePlan.name}</h1>
                <p className="student-copy">
                  <strong>{activePlan.major.name}</strong>
                  {activePlan.minor && <> <span aria-hidden="true">·</span> Minor: {activePlan.minor.name}</>}
                </p>
                <div className="plan-overview-tags">
                  <span>{activePlan.startTerm ? `Starts ${getTermName(activePlan.startTerm)}` : "Start semester flexible"}</span>
                  <span>{activePlan.endTerm ? `Target ${getTermName(activePlan.endTerm)}` : "End semester flexible"}</span>
                </div>
              </div>
              <button
                className="secondary-button edit-plan-button"
                type="button"
                onClick={() => {
                  setEditingPlan(activePlan);
                  setSetupOpen(true);
                }}
              >
                Edit plan details
              </button>
            </section>
            <PlanBoard
              courses={activePlan.courses}
              onRemove={removeCourse}
              onMove={moveCourse}
              initialTerm={activePlan.startTerm || "fall-2026"}
            />
            <div className="content-grid" id="courses">
              <CourseSearch plannedCourseIds={plannedCourseIds} onAdd={addCourse} />
              <RequirementsPanel programs={activePrograms} />
            </div>
          </>
        ) : (
          <PlanLibrary
            plans={plans}
            onOpen={setSelectedPlanId}
            onCreate={() => {
              setEditingPlan(null);
              setSetupOpen(true);
            }}
            onEdit={(plan) => {
              setEditingPlan(plan);
              setSetupOpen(true);
            }}
            onDelete={(planId) => {
              setPlans((current) => current.filter((plan) => plan.id !== planId));
            }}
          />
        )}
      </main>

      <footer>
        <span>Better Grad Planner</span>
        <span>Built for a clearer path forward.</span>
      </footer>
    </div>
  );
}

function getTermName(termId: string) {
  const match = /^(fall|winter|spring)-(\d{4})$/.exec(termId);
  if (!match) return termId;
  return `${match[1][0].toUpperCase()}${match[1].slice(1)} ${match[2]}`;
}
