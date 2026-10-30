import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AcademicTerm,
  Course,
  createPlan,
  createPlannedCourse,
  deletePlan,
  DegreePlan,
  deletePlannedCourse,
  getCourse,
  getCurrentUser,
  listAllPrograms,
  listPlannedCourses,
  listPlans,
  listTerms,
  logout,
  Program,
  updatePlan,
  updatePlannedCourse,
  User,
} from "./api/client";
import { CourseSearch } from "./components/CourseSearch";
import { PlanBoard, PlannedCourse } from "./components/PlanBoard";
import { PlanNotes } from "./components/PlanNotes";
import { PlanSidebar } from "./components/PlanSidebar";
import { RequirementsPanel } from "./components/RequirementsPanel";
import { SignIn } from "./components/SignIn";

type AppRoute = {
  planId: string | null;
  view: "planner" | "notes";
};

function routeFromPath(pathname = window.location.pathname): AppRoute {
  const match = pathname.match(/^\/plans\/([^/]+)(?:\/(notes))?\/?$/);
  return {
    planId: match?.[1] ?? null,
    view: match?.[2] === "notes" ? "notes" : "planner",
  };
}

type CreatePlanDialogProps = {
  open: boolean;
  programs: Program[];
  loadingPrograms: boolean;
  existingPlanCount: number;
  onClose: () => void;
  onCreate: (name: string, programId: string) => Promise<void>;
};

function CreatePlanDialog({
  open,
  programs,
  loadingPrograms,
  existingPlanCount,
  onClose,
  onCreate,
}: CreatePlanDialogProps) {
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [programQuery, setProgramQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setProgramId("");
    setProgramQuery("");
    setError("");
  }, [open]);

  if (!open) return null;

  const normalizedProgramQuery = programQuery.trim().toLowerCase();
  const filteredPrograms = normalizedProgramQuery
    ? programs.filter((program) =>
        [program.name, program.code, program.catalogYear]
          .filter((value) => value !== undefined && value !== null)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedProgramQuery),
          ),
      )
    : programs;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !programId) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(name.trim(), programId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create the plan.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="plan-dialog-backdrop" role="presentation">
      <section
        className="plan-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-plan-title"
      >
        <div className="plan-dialog__header">
          <div>
            <p className="eyebrow">NEW ROADMAP</p>
            <h2 id="create-plan-title">Create a grad plan</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <form className="plan-dialog__form" onSubmit={handleSubmit}>
          <label htmlFor="plan-name">Plan name</label>
          <input
            id="plan-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: Computer Science 2028"
            maxLength={100}
            autoFocus
            required
          />
          <label htmlFor="plan-program-search">Find a degree program</label>
          <input
            id="plan-program-search"
            type="search"
            value={programQuery}
            onChange={(event) => {
              setProgramQuery(event.target.value);
              setProgramId("");
            }}
            placeholder="Search, for example: Software Engineering"
            disabled={loadingPrograms}
          />
          <label htmlFor="plan-program">Degree program</label>
          <select
            id="plan-program"
            value={programId}
            onChange={(event) => setProgramId(event.target.value)}
            disabled={loadingPrograms}
            required
          >
            <option value="">
              {loadingPrograms ? "Loading programs…" : "Select a program"}
            </option>
            {filteredPrograms.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
                {program.code ? ` (${program.code})` : ""}
                {program.catalogYear ? ` · ${program.catalogYear}` : ""}
              </option>
            ))}
          </select>
          {!loadingPrograms && programs.length === 0 && (
            <p className="error-message">
              No degree programs are available. Seed the catalog database first.
            </p>
          )}
          {!loadingPrograms &&
            programs.length > 0 &&
            filteredPrograms.length === 0 && (
              <p className="plan-dialog__hint plan-dialog__hint--left">
                No degree programs match “{programQuery}”.
              </p>
            )}
          {error && <p className="error-message">{error}</p>}
          <div className="plan-dialog__actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving || loadingPrograms || programs.length === 0}
            >
              {saving ? "Creating…" : "Create plan"}
            </button>
          </div>
          {existingPlanCount === 0 && (
            <p className="plan-dialog__hint">
              Your first plan will become your default plan.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [plans, setPlans] = useState<DegreePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [route, setRoute] = useState<AppRoute>(() => routeFromPath());
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [plannerError, setPlannerError] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [academicTerms, setAcademicTerms] = useState<AcademicTerm[]>([]);
  const notesDirtyRef = useRef(false);
  const acceptedPathRef = useRef(window.location.pathname);

  const activePlan =
    plans.find((plan) => plan.id === route.planId) ?? null;

  useEffect(() => {
    getCurrentUser()
      .then((result) => setUser(result.data))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (
        notesDirtyRef.current &&
        !window.confirm("Discard your unsaved plan notes?")
      ) {
        window.history.pushState({}, "", acceptedPathRef.current);
        return;
      }
      notesDirtyRef.current = false;
      acceptedPathRef.current = window.location.pathname;
      setRoute(routeFromPath());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleNotesDirtyChange = useCallback((dirty: boolean) => {
    notesDirtyRef.current = dirty;
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setPlansLoading(true);
    setPlansError("");
    listPlans()
      .then((result) => {
        if (cancelled) return;
        setPlans(result.data);
        const currentRoute = routeFromPath();
        const requestedPlan = result.data.find(
          (plan) => plan.id === currentRoute.planId,
        );
        if (!requestedPlan && result.data.length > 0) {
          const defaultPlan =
            result.data.find((plan) => plan.isDefault) ?? result.data[0];
          const href = `/plans/${defaultPlan.id}`;
          window.history.replaceState({}, "", href);
          acceptedPathRef.current = href;
          setRoute(routeFromPath(href));
        }
      })
      .catch((error) => {
        if (!cancelled)
          setPlansError(
            error instanceof Error ? error.message : "Unable to load plans.",
          );
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listTerms()
      .then((result) => {
        if (!cancelled) setAcademicTerms(result.data);
      })
      .catch(() => {
        if (!cancelled) setAcademicTerms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!activePlan || route.view !== "planner") {
      setPlannedCourses([]);
      return;
    }
    let cancelled = false;
    setPlannedCourses([]);
    setCoursesLoading(true);
    setPlannerError("");
    listPlannedCourses(activePlan.id)
      .then(async (result) => {
        const courses = await Promise.all(
          result.data.map(async (entry) => {
            const course = await getCourse(entry.courseId);
            return {
              ...course.data,
              entryId: entry.id,
              termId: entry.termId,
              sequence: entry.sequence,
              notes: entry.notes,
            } satisfies PlannedCourse;
          }),
        );
        if (!cancelled) setPlannedCourses(courses);
      })
      .catch((error) => {
        if (!cancelled)
          setPlannerError(
            error instanceof Error
              ? error.message
              : "Unable to load planned courses.",
          );
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePlan?.id, route.view]);

  useEffect(() => {
    if (!createDialogOpen || programs.length > 0) return;
    setProgramsLoading(true);
    let cancelled = false;
    listAllPrograms()
      .then((result) => {
        if (!cancelled) setPrograms(result);
      })
      .catch(() => {
        if (!cancelled) setPrograms([]);
      })
      .finally(() => {
        if (!cancelled) setProgramsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createDialogOpen, programs.length]);

  const plannedCourseIds = useMemo(
    () => new Set(plannedCourses.map((course) => course.id)),
    [plannedCourses],
  );
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

  function navigate(href: string) {
    if (
      notesDirtyRef.current &&
      !window.confirm("Discard your unsaved plan notes?")
    )
      return;
    notesDirtyRef.current = false;
    let destination = href;
    const nextRoute = routeFromPath(href);
    if (!nextRoute.planId && plans.length > 0) {
      const defaultPlan = plans.find((plan) => plan.isDefault) ?? plans[0];
      destination = `/plans/${defaultPlan.id}`;
    }
    window.history.pushState({}, "", destination);
    acceptedPathRef.current = destination;
    setRoute(routeFromPath(destination));
  }

  async function handleCreatePlan(name: string, programId: string) {
    const result = await createPlan({
      name,
      programId,
      isDefault: plans.length === 0,
    });
    setPlans((current) => [result.data, ...current]);
    setCreateDialogOpen(false);
    navigate(`/plans/${result.data.id}`);
  }

  async function handleDeletePlan(plan: DegreePlan) {
    if (
      !window.confirm(
        `Delete “${plan.name}”? This will permanently remove the plan and all of its planned courses.`,
      )
    )
      return;
    if (
      notesDirtyRef.current &&
      !window.confirm("Discard your unsaved plan notes and delete this plan?")
    )
      return;

    try {
      await deletePlan(plan.id);
      const remainingPlans = plans.filter((current) => current.id !== plan.id);
      setPlans(remainingPlans);
      notesDirtyRef.current = false;

      if (route.planId === plan.id) {
        const nextPlan =
          remainingPlans.find((current) => current.isDefault) ?? remainingPlans[0];
        const destination = nextPlan ? `/plans/${nextPlan.id}` : "/plans";
        window.history.replaceState({}, "", destination);
        acceptedPathRef.current = destination;
        setRoute(routeFromPath(destination));
      }
    } catch (error) {
      setPlansError(
        error instanceof Error ? error.message : "Unable to delete the plan.",
      );
    }
  }

  async function addCourse(course: Course) {
    if (!activePlan || plannedCourseIds.has(course.id)) return;
    setPlannerError("");
    try {
      const result = await createPlannedCourse(activePlan.id, {
        courseId: course.id,
        termId: null,
        sequence: plannedCourses.length,
      });
      setPlannedCourses((current) => [
        ...current,
        {
          ...course,
          entryId: result.data.id,
          termId: result.data.termId,
          sequence: result.data.sequence,
          notes: result.data.notes,
        },
      ]);
    } catch (error) {
      setPlannerError(
        error instanceof Error ? error.message : "Unable to add the course.",
      );
    }
  }

  async function removeCourse(courseEntryId: string) {
    if (!activePlan) return;
    setPlannerError("");
    try {
      await deletePlannedCourse(activePlan.id, courseEntryId);
      setPlannedCourses((current) =>
        current.filter((course) => course.entryId !== courseEntryId),
      );
    } catch (error) {
      setPlannerError(
        error instanceof Error ? error.message : "Unable to remove the course.",
      );
    }
  }

  async function moveCourse(courseEntryId: string, termId: string | null) {
    if (!activePlan) return;
    setPlannerError("");
    const previousTermId =
      plannedCourses.find((course) => course.entryId === courseEntryId)
        ?.termId ?? null;
    setPlannedCourses((current) =>
      current.map((course) =>
        course.entryId === courseEntryId ? { ...course, termId } : course,
      ),
    );
    try {
      await updatePlannedCourse(activePlan.id, courseEntryId, { termId });
    } catch (error) {
      setPlannedCourses((current) =>
        current.map((course) =>
          course.entryId === courseEntryId
            ? { ...course, termId: previousTermId }
            : course,
        ),
      );
      setPlannerError(
        error instanceof Error ? error.message : "Unable to move the course.",
      );
    }
  }

  async function saveNotes(notes: string) {
    if (!activePlan) return;
    const result = await updatePlan(activePlan.id, {
      notes: notes.trim() ? notes : null,
    });
    setPlans((current) =>
      current.map((plan) => (plan.id === result.data.id ? result.data : plan)),
    );
  }

  async function handleSignOut() {
    if (
      notesDirtyRef.current &&
      !window.confirm("Discard your unsaved plan notes and sign out?")
    )
      return;
    notesDirtyRef.current = false;
    try {
      await logout();
    } finally {
      setUser(null);
      setPlans([]);
      setPlannedCourses([]);
      window.history.replaceState({}, "", "/");
      acceptedPathRef.current = "/";
      setRoute(routeFromPath("/"));
    }
  }

  if (authLoading)
    return (
      <main className="auth-shell">
        <p className="muted">Loading your account…</p>
      </main>
    );

  if (!user) return <SignIn onAuthenticated={setUser} />;

  return (
    <div className="planner-app-shell">
      <PlanSidebar
        plans={plans}
        activePlanId={activePlan?.id ?? null}
        activeView={route.view}
        user={user}
        onNavigate={navigate}
        onCreatePlan={() => setCreateDialogOpen(true)}
        onDeletePlan={(plan) => void handleDeletePlan(plan)}
        onSignOut={() => void handleSignOut()}
      />
      <div className="planner-app-content">
        {plansLoading && (
          <main className="page-state">
            <p className="muted">Loading your graduation plans…</p>
          </main>
        )}
        {!plansLoading && plansError && (
          <main className="page-state">
            <p className="error-message">{plansError}</p>
          </main>
        )}
        {!plansLoading && !plansError && plans.length === 0 && (
          <main className="empty-plans-page">
            <p className="eyebrow">YOUR ROADMAP STARTS HERE</p>
            <h1>Create your first graduation plan.</h1>
            <p>
              Choose a degree program, map out your courses, and keep one living
              notes document alongside the plan.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => setCreateDialogOpen(true)}
            >
              Create a grad plan <span>→</span>
            </button>
          </main>
        )}
        {!plansLoading && !plansError && activePlan && route.view === "notes" && (
          <PlanNotes
            plan={activePlan}
            onSave={saveNotes}
            onBack={() => navigate(`/plans/${activePlan.id}`)}
            onDirtyChange={handleNotesDirtyChange}
          />
        )}
        {!plansLoading && !plansError && activePlan && route.view === "planner" && (
          <main className="plan-page">
            <section className="student-header" id="overview">
              <div>
                <p className="eyebrow">CURRENT GRAD PLAN</p>
                <h1>{activePlan.name}</h1>
                <p className="student-copy">
                  Plan courses, check requirements, or open this plan’s notes
                  from the sidebar.
                </p>
              </div>
              <div className="degree-progress">
                <span>{activePlan.status.toLowerCase()} plan</span>
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
            <section className="stats-grid" aria-label="Plan summary">
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
            {plannerError && <p className="error-message">{plannerError}</p>}
            {coursesLoading ? (
              <p className="muted">Loading this plan’s courses…</p>
            ) : (
              <PlanBoard
                courses={plannedCourses}
                terms={academicTerms}
                onRemove={removeCourse}
                onMove={moveCourse}
              />
            )}
            {!coursesLoading && (
              <div className="content-grid" id="courses">
                <CourseSearch
                  plannedCourseIds={plannedCourseIds}
                  onAdd={(course) => void addCourse(course)}
                />
                <RequirementsPanel programId={activePlan.programId} />
              </div>
            )}
          </main>
        )}
      </div>
      <CreatePlanDialog
        open={createDialogOpen}
        programs={programs}
        loadingPrograms={programsLoading}
        existingPlanCount={plans.length}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreatePlan}
      />
    </div>
  );
}
