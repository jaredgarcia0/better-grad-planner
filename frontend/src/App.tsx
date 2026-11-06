import { useCallback, useEffect, useRef, useState } from "react";
import {
  Course,
  getCourse,
  getCurrentUser,
  listCoursePrerequisites,
  logout,
  User,
} from "./api/client";
import { CourseSearch } from "./components/CourseSearch";
import { CourseDetailsModal } from "./components/CourseDetailsModal";
import {
  GraduationPlan,
  getPlanPrograms,
  PlanLibrary,
  PlanSetup,
} from "./components/PlanLibrary";
import { PlanBoard, PlannedCourse } from "./components/PlanBoard";
import { PlanNotes } from "./components/PlanNotes";
import { PlanSidebar } from "./components/PlanSidebar";
import { RequirementsPanel } from "./components/RequirementsPanel";
import { SignIn } from "./components/SignIn";
import { getTermLabel, listPlanTerms, plannerYears } from "./plannerTerms";
import { Dashboard } from "./components/Dashboard";
import { normalizeDashboardLayout, type DashboardWidgetType } from "./dashboardLayout";
import { usePlanWorkspace } from "./usePlanWorkspace";
import "./workspace.css";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notesDirty = useRef(false);
  const onNotesDirtyChange = useCallback((dirty: boolean) => { notesDirty.current = dirty; }, []);
  const workspaceId = user ? `user-${user.id}` : guestMode ? "guest" : null;
  const workspace = usePlanWorkspace(workspaceId, Boolean(user));
  const { plans } = workspace;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [notesPlanId, setNotesPlanId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<GraduationPlan | null>(null);
  const [courseToPlace, setCourseToPlace] = useState<Course | null>(null);
  const [selectedTermId, setSelectedTermId] = useState("fall-2026");
  const [prerequisiteIssues, setPrerequisiteIssues] = useState<
    Record<string, string[]>
  >({});
  const [prerequisiteStatus, setPrerequisiteStatus] = useState<"loading" | "ready" | "error">("ready");
  const [issueCourse, setIssueCourse] = useState<PlannedCourse | null>(null);
  const [plannedCourseDetails, setPlannedCourseDetails] =
    useState<PlannedCourse | null>(null);

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

  useEffect(() => {
    setSelectedPlanId(null);
    setSetupOpen(false);
    setEditingPlan(null);
  }, [workspaceId]);

  const activePlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;

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
        year.terms.map((term) => [term.id, term.label]),
      ),
    );
    const plannedCourses = activePlan?.courses ?? [];

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
          const currentOrder =
            termOrder.get(course.termId) ?? Number.MAX_SAFE_INTEGER;
          const scheduledCourses = new Map(
            plannedCourses.map((planned) => [planned.id, planned]),
          );
          const messages: string[] = [];
          const alternativeGroups = new Map<number, typeof prerequisites>();

          for (const prerequisite of prerequisites) {
            if (prerequisite.isAlternative) {
              const group =
                alternativeGroups.get(prerequisite.groupNumber) ?? [];
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
            if (
              scheduledOrder === undefined ||
              scheduledOrder >= currentOrder
            ) {
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
              return (
                scheduledOrder !== undefined && scheduledOrder < currentOrder
              );
            });
            if (!satisfied) {
              messages.push(
                `One of ${alternatives
                  .map((prerequisite) => prerequisite.course.code)
                  .join(" or ")} must be planned before ${course.code}.`,
              );
            }
          }

          return { courseId: course.id, messages, prerequisites };
        }),
      );
      if (cancelled) return;

      const issueMap = new Map(
        issues
          .filter((result) => result.messages.length > 0)
          .map((result) => [result.courseId, result.messages]),
      );
      const scheduledCourses = new Map(
        plannedCourses.map((planned) => [planned.id, planned]),
      );
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
              return Boolean(scheduled && issueMap.has(scheduled.id));
            },
          );
          if (blockedPrerequisites.length === 0) continue;
          const messages = issueMap.get(result.courseId) ?? [];
          if (
            messages.some((message) =>
              message.startsWith("Fix prerequisite issue:"),
            )
          ) {
            continue;
          }
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
      setPrerequisiteIssues(Object.fromEntries(issueMap));
      setPrerequisiteStatus("ready");
    }

    if (!activePlan || plannedCourses.length === 0) {
      setPrerequisiteIssues({});
      setPrerequisiteStatus("ready");
    } else {
      setPrerequisiteStatus("loading");
      void checkPrerequisites().catch(() => {
        if (!cancelled) { setPrerequisiteIssues({}); setPrerequisiteStatus("error"); }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [activePlan?.id, activePlan?.courses]);

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
  const plannedCourseIds = new Set(
    activePlan?.courses.map((course) => course.id) ?? [],
  );
  const planTerms = listPlanTerms();
  const planStartIndex = activePlan?.startTerm
    ? Math.max(
        planTerms.findIndex((term) => term.id === activePlan.startTerm),
        0,
      )
    : 0;
  const planEndMatch = activePlan?.endTerm
    ? planTerms.findIndex((term) => term.id === activePlan.endTerm)
    : planTerms.length - 1;
  const planEndIndex =
    planEndMatch < planStartIndex ? planStartIndex : planEndMatch;
  const availablePlanTermIds = new Set(
    planTerms.slice(planStartIndex, planEndIndex + 1).map((term) => term.id),
  );
  const availablePlanYears = plannerYears
    .map((year) => ({
      ...year,
      terms: year.terms.filter((term) => availablePlanTermIds.has(term.id)),
    }))
    .filter((year) => year.terms.length > 0);

  async function handleSavePlan(plan: GraduationPlan) {
    await workspace.savePlan(plan);
    setSelectedPlanId(plan.id);
    setNotesPlanId(null);
    setSetupOpen(false);
    setEditingPlan(null);
  }

  function updateActivePlanCourses(
    update: (courses: GraduationPlan["courses"]) => GraduationPlan["courses"],
  ) {
    if (!activePlan) return;
    void workspace.updatePlan(activePlan.id, (plan) => ({ ...plan, courses: update(plan.courses) })).catch(() => undefined);
  }

  function requestCoursePlacement(course: Course) {
    if (plannedCourseIds.has(course.id)) return;
    if (!activePlan) return;
    setSelectedTermId(activePlan.startTerm || "fall-2026");
    setCourseToPlace(course);
  }

  function placeCourse(course: Course, termId: string) {
    updateActivePlanCourses((current) => {
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
    if (!canNavigate()) return;
    try {
      if (user) await logout();
    } finally {
      setProfileOpen(false);
      setUser(null);
      setGuestMode(false);
      setSelectedPlanId(null);
      setNotesPlanId(null);
      setSetupOpen(false);
      setEditingPlan(null);
      setCourseToPlace(null);
      setIssueCourse(null);
      setPlannedCourseDetails(null);
      setPrerequisiteIssues({});
    }
  }

  const activePrograms = activePlan ? getPlanPrograms(activePlan) : [];

  function canNavigate() {
    if (!window.dispatchEvent(new Event("dashboard:before-navigate", { cancelable: true }))) return false;
    if (notesDirty.current && !window.confirm("Discard unsaved notes?")) return false;
    return !workspace.isSaving || window.confirm("Changes are still saving. Leave this page?");
  }

  async function handleDeletePlan(planId: string) {
    if (!canNavigate()) return;
    try {
      await workspace.deletePlan(planId);
      if (selectedPlanId === planId) setSelectedPlanId(null);
    } catch { /* The workspace banner reports storage errors. */ }
  }

  function renderDashboardWidget(widget: DashboardWidgetType) {
    if (!activePlan) return null;
    switch (widget) {
      case "planner": {
        const unassigned = activePlan.courses.filter((course) => !availablePlanTermIds.has(course.termId));
        return <>
          {unassigned.length > 0 && <section className="dashboard-summary">
            <h2>Unscheduled courses</h2>
            <p className="muted">These courses need a semester within this plan’s range.</p>
            {unassigned.map((course) => <label className="dashboard-unassigned" key={course.id}>
              <span>{course.code} · {course.title}</span>
              <select aria-label={`Schedule ${course.code}`} value="" onChange={(event) => moveCourse(course.id, event.target.value)}>
                <option value="" disabled>Choose a semester</option>
                {planTerms.filter((term) => availablePlanTermIds.has(term.id)).map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
              </select>
            </label>)}
          </section>}
          <PlanBoard courses={activePlan.courses} onRemove={removeCourse} onMove={moveCourse} onPlace={placeCourse}
            startTerm={activePlan.startTerm} endTerm={activePlan.endTerm} prerequisiteIssues={prerequisiteIssues}
            onShowPrerequisiteIssue={setIssueCourse} onShowCourseDetails={setPlannedCourseDetails} />
        </>;
      }
      case "course-search": return <CourseSearch plannedCourseIds={plannedCourseIds} onAdd={requestCoursePlacement} />;
      case "requirements": return <RequirementsPanel programs={activePrograms} onPlanCourse={requestCoursePlacement} />;
      case "notes": return <section className="dashboard-summary">
        <p className="eyebrow">YOUR REMINDERS</p><h2>Plan notes</h2>
        <p className="dashboard-note-preview">{activePlan.notes || "Keep reminders, advising decisions, and useful links with this plan."}</p>
        <button className="secondary-button" type="button" onClick={() => { if (canNavigate()) setNotesPlanId(activePlan.id); }}>Edit notes</button>
      </section>;
      case "progress": return <section className="dashboard-summary">
        <p className="eyebrow">YOUR ROADMAP AT A GLANCE</p><h2>Credit summary</h2>
        <p className="dashboard-credit-total">{activePlan.courses.reduce((total, course) => total + course.credits, 0)} <span>planned credits</span></p>
        <p>{activePlan.courses.length} courses across {new Set(activePlan.courses.map((course) => course.termId).filter(Boolean)).size} semesters.</p>
        {activePlan.major.totalCredits != null && <p className="muted">{activePlan.major.name}: {activePlan.major.totalCredits} required credits. Planned credits do not indicate completed degree requirements.</p>}
      </section>;
      case "prerequisites": return <section className="dashboard-summary">
        <p className="eyebrow">CHECK YOUR SEQUENCE</p><h2>Prerequisite warnings</h2>
        <p className="muted">Based on courses in this plan; completed and transfer coursework are not included.</p>
        {prerequisiteStatus === "loading" ? <p role="status">Checking prerequisites…</p> : prerequisiteStatus === "error" ? <p role="alert">Prerequisites could not be checked. Try reopening the plan.</p> : Object.keys(prerequisiteIssues).length ? <ul className="dashboard-warning-list">{activePlan.courses.filter((course) => prerequisiteIssues[course.id]?.length).map((course) => <li key={course.id}>
          <button type="button" className="text-button" onClick={() => setIssueCourse(course)}>{course.code}</button>
          <p>{prerequisiteIssues[course.id][0]}</p>
        </li>)}</ul> : <p>No prerequisite warnings found in this plan.</p>}
      </section>;
    }
  }

  function handleSidebarNavigate(href: string) {
    if (!canNavigate()) return;
    const planId = href.match(/^\/plans\/([^/]+)/)?.[1];
    const isNotes = /\/notes\/?$/.test(href);
    setSetupOpen(false);
    setEditingPlan(null);
    setSelectedPlanId(planId ?? null);
    setNotesPlanId(isNotes ? planId ?? null : null);
  }

  return (
    <div className="app-shell">
      <div className="planner-shell">
        <PlanSidebar
          plans={plans}
          activePlanId={selectedPlanId}
          activeView={notesPlanId === selectedPlanId ? "notes" : "planner"}
          user={user ?? { email: "Guest student" }}
          onNavigate={handleSidebarNavigate}
          onCreatePlan={() => {
            if (!canNavigate()) return;
            setEditingPlan(null);
            setSetupOpen(true);
          }}
          onDeletePlan={(plan) => { void handleDeletePlan(plan.id); }}
          onSignOut={handleSignOut}
        />
        <div className="planner-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Better Grad Planner home">
          <span className="brand-mark">B</span>
          <span>Better Grad Planner</span>
        </a>
        {activePlan && !setupOpen && (
          <button
            className="header-plans-link"
            type="button"
            onClick={() => { if (canNavigate()) setSelectedPlanId(null); }}
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
        {workspace.saveError && <div className="workspace-banner workspace-banner--error" role="alert">
          <p>Changes could not be saved. {workspace.saveError} Your previous saved plan is still available; retry the action to save your changes.</p>
          <button className="secondary-button" type="button" onClick={workspace.dismissSaveError}>Dismiss</button>
        </div>}
        {workspace.isSaving && <p className="workspace-save-status" role="status">Saving changes…</p>}
        {workspace.localPlanCount > 0 && <div className="workspace-banner" role="status">
          <p>{workspace.localPlanCount} plan{workspace.localPlanCount === 1 ? " is" : "s are"} saved in this browser. Import them to access them from your account on other devices.</p>
          <button className="secondary-button" type="button" disabled={workspace.isSaving} onClick={() => { void workspace.importLocalPlans().catch(() => undefined); }}>Import browser plans</button>
        </div>}
        {workspace.loading ? <p className="workspace-loading" role="status">Loading your plans…</p>
        : workspace.loadError ? <section className="workspace-banner workspace-banner--error" role="alert">
          <p>Your plans could not be loaded. {workspace.loadError}</p>
          <button className="secondary-button" type="button" onClick={workspace.reload}>Try again</button>
        </section> : setupOpen ? (
          <PlanSetup
            key={editingPlan?.id ?? "new-plan"}
            initialPlan={editingPlan}
            onCancel={() => {
              setSetupOpen(false);
              setEditingPlan(null);
            }}
            onSave={handleSavePlan}
          />
        ) : activePlan && notesPlanId === activePlan.id ? (
          <PlanNotes
            plan={activePlan}
            onSave={async (notes) => {
              await workspace.updatePlan(activePlan.id, (plan) => ({ ...plan, notes }));
            }}
            onBack={() => { if (canNavigate()) setNotesPlanId(null); }}
            onDirtyChange={onNotesDirtyChange}
          />
        ) : activePlan ? (
          <>
            <section className="plan-overview">
              <div className="plan-overview-copy">
                <p className="eyebrow">YOUR GRADUATION PLAN</p>
                <h1>{activePlan.name}</h1>
                <p className="student-copy">
                  {getPlanPrograms(activePlan).map(({ role, program }, index) => (
                    <span key={program.id}>
                      {index > 0 && " · "}
                      <strong>{role[0]}{role.slice(1).toLowerCase()}:</strong> {program.name}
                    </span>
                  ))}
                  {activePlan && false && activePlan?.minor && (
                    <>
                      {" "}
                      <span aria-hidden="true">·</span> Minor:{" "}
                      {activePlan?.minor?.name}
                    </>
                  )}
                </p>
                <div className="plan-overview-tags">
                  <span>
                    {activePlan.startTerm
                      ? `Starts ${getTermLabel(activePlan.startTerm)}`
                      : "Start semester flexible"}
                  </span>
                  <span>
                    {activePlan.endTerm
                      ? `Target ${getTermLabel(activePlan.endTerm)}`
                      : "End semester flexible"}
                  </span>
                </div>
              </div>
              <button
                className="secondary-button edit-plan-button"
                type="button"
                onClick={() => {
                  if (!canNavigate()) return;
                  setEditingPlan(activePlan);
                  setSetupOpen(true);
                }}
              >
                Edit plan details
              </button>
            </section>
            <Dashboard key={activePlan.id} planId={activePlan.id}
              layout={normalizeDashboardLayout(activePlan.dashboardLayout)}
              onSave={async (dashboardLayout) => { await workspace.updatePlan(activePlan.id, (plan) => ({ ...plan, dashboardLayout })); }}
              renderWidget={renderDashboardWidget} />
          </>
        ) : (
          <PlanLibrary
            plans={plans}
            onOpen={(id) => { if (canNavigate()) setSelectedPlanId(id); }}
            onCreate={() => {
              if (!canNavigate()) return;
              setEditingPlan(null);
              setSetupOpen(true);
            }}
            onEdit={(plan) => {
              if (!canNavigate()) return;
              setEditingPlan(plan);
              setSetupOpen(true);
            }}
            onDelete={(planId) => { void handleDeletePlan(planId); }}
          />
        )}
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
              {availablePlanYears.map((year) => (
                <optgroup label={year.label} key={year.id}>
                  {year.terms.map((term) => (
                    <option value={term.id} key={term.id}>
                      {term.label}
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

      {plannedCourseDetails && (
        <CourseDetailsModal
          course={plannedCourseDetails}
          plannedTermLabel={getTermLabel(plannedCourseDetails.termId)}
          onClose={() => setPlannedCourseDetails(null)}
        />
      )}

      <footer>
        <span>Better Grad Planner</span>
        <span>Built for a clearer path forward.</span>
      </footer>
        </div>
    </div>
    </div>
  );
}
