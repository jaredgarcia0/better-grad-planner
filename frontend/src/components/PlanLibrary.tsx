import { FormEvent, useEffect, useState } from "react";
import { listPrograms, Program } from "../api/client";
import {
  getDefaultTermRange,
  getTermLabel,
  listPlanTerms,
} from "../plannerTerms";
import { PlannedCourse } from "./PlanBoard";

export type GraduationPlan = {
  id: string;
  name: string;
  major: Program;
  minor: Program | null;
  startTerm: string;
  endTerm: string;
  courses: PlannedCourse[];
  notes?: string;
  requirementLayout?: import("../api/client").RequirementSectionId[];
};

function termRangeLabel(startTerm: string, endTerm: string) {
  const start = getTermLabel(startTerm);
  const end = getTermLabel(endTerm);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Starting ${start}`;
  if (end) return `Through ${end}`;
  return "No semester dates set";
}

export function PlanLibrary({
  plans,
  onOpen,
  onCreate,
  onEdit,
  onDelete,
}: {
  plans: GraduationPlan[];
  onOpen: (planId: string) => void;
  onCreate: () => void;
  onEdit: (plan: GraduationPlan) => void;
  onDelete: (planId: string) => void;
}) {
  return (
    <section className="plan-library">
      <div className="plan-library-heading">
        <div>
          <p className="eyebrow">YOUR NEXT STEPS</p>
          <h1>Your graduation plans</h1>
          <p className="student-copy">
            Keep a few possible paths in view and open the one you want to work
            on.
          </p>
        </div>
        <button
          className="primary-button create-plan-button"
          type="button"
          onClick={onCreate}
        >
          Create a plan <span aria-hidden="true">+</span>
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="plan-empty-state">
          <div className="plan-empty-icon" aria-hidden="true">
            ↗
          </div>
          <p className="eyebrow">A path that fits you</p>
          <h2>Start with a major</h2>
          <p className="muted">
            Create a plan, choose a major, and add an optional minor and
            semester range. You can make another plan whenever you want to
            explore a different path.
          </p>
          <button className="primary-button" type="button" onClick={onCreate}>
            Create your first plan <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : (
        <div className="plan-card-grid">
          {plans.map((plan) => {
            const plannedCredits = plan.courses.reduce(
              (total, course) => total + course.credits,
              0,
            );
            return (
              <article className="graduation-plan-card" key={plan.id}>
                <div className="plan-card-topline">
                  <span className="plan-card-icon" aria-hidden="true">
                    B
                  </span>
                  <div className="plan-card-actions">
                    <button
                      className="plan-card-menu"
                      type="button"
                      aria-label={`Edit ${plan.name}`}
                      onClick={() => onEdit(plan)}
                    >
                      ⋯
                    </button>
                    <button
                      className="plan-delete-button"
                      type="button"
                      aria-label={`Delete ${plan.name}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete “${plan.name}”? This removes its planned courses.`,
                          )
                        ) {
                          onDelete(plan.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <h2>{plan.name}</h2>
                <p className="plan-card-major">{plan.major.name}</p>
                <div className="plan-card-details">
                  {plan.minor ? (
                    <span>
                      <b>Minor</b>
                      {plan.minor.name}
                    </span>
                  ) : (
                    <span>
                      <b>Minor</b>Not selected
                    </span>
                  )}
                  <span>
                    <b>Schedule</b>
                    {termRangeLabel(plan.startTerm, plan.endTerm)}
                  </span>
                </div>
                <div className="plan-card-footer">
                  <span>
                    {plan.courses.length} courses · {plannedCredits} credits
                  </span>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => onOpen(plan.id)}
                  >
                    Open plan <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProgramPicker({
  label,
  help,
  degreeType,
  selected,
  onChange,
}: {
  label: string;
  help: string;
  degreeType: "BACHELOR" | "MINOR";
  selected: Program | null;
  onChange: (program: Program | null) => void;
}) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(!selected);
  const [results, setResults] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await listPrograms(query, {
          degreeType,
          pageSize: 100,
        });
        if (!cancelled) setResults(response.data);
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load programs",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [degreeType, open, query]);

  function clearSelection() {
    onChange(null);
    setQuery("");
    setOpen(true);
  }

  return (
    <div className="program-picker">
      <div className="program-picker-label">
        <label htmlFor={`program-${degreeType}`}>{label}</label>
        <span>{help}</span>
      </div>
      {selected && !open ? (
        <div className="selected-program">
          <div>
            <strong>{selected.name}</strong>
            <span>
              {degreeType === "MINOR" ? "Minor program" : "Bachelor’s program"}
            </span>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={clearSelection}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="program-search-wrap">
            <span className="program-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              id={`program-${degreeType}`}
              type="search"
              value={query}
              autoComplete="off"
              aria-expanded={open}
              aria-controls={`program-results-${degreeType}`}
              placeholder={`Search ${degreeType === "MINOR" ? "minors" : "majors"}`}
              onFocus={() => setOpen(true)}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
            />
            {selected && (
              <button
                className="picker-cancel"
                type="button"
                onClick={() => {
                  setQuery(selected.name);
                  setOpen(false);
                }}
              >
                Cancel
              </button>
            )}
          </div>
          {open && (
            <div
              className="program-results"
              id={`program-results-${degreeType}`}
              role="listbox"
            >
              {loading && <p className="muted">Searching the catalog…</p>}
              {error && <p className="error-message">{error}</p>}
              {!loading &&
                !error &&
                results.map((program) => (
                  <button
                    className="program-result"
                    type="button"
                    role="option"
                    aria-selected={selected?.id === program.id}
                    key={program.id}
                    onClick={() => {
                      onChange(program);
                      setQuery(program.name);
                      setOpen(false);
                    }}
                  >
                    <span>{program.name}</span>
                    <b aria-hidden="true">→</b>
                  </button>
                ))}
              {!loading && !error && results.length === 0 && (
                <p className="muted">
                  No programs matched. Try a different search.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function PlanSetup({
  initialPlan,
  onCancel,
  onSave,
}: {
  initialPlan: GraduationPlan | null;
  onCancel: () => void;
  onSave: (plan: GraduationPlan) => void;
}) {
  const [name, setName] = useState(initialPlan?.name ?? "");
  const [major, setMajor] = useState<Program | null>(
    initialPlan?.major ?? null,
  );
  const [minor, setMinor] = useState<Program | null>(
    initialPlan?.minor ?? null,
  );
  const [minorVisible, setMinorVisible] = useState(Boolean(initialPlan?.minor));
  const [defaultTerms] = useState(getDefaultTermRange);
  const [startTerm, setStartTerm] = useState(
    initialPlan?.startTerm ?? defaultTerms.startTerm,
  );
  const [endTerm, setEndTerm] = useState(
    initialPlan?.endTerm ?? defaultTerms.endTerm,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const terms = listPlanTerms();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!major) {
      setFormError("Choose a major to continue.");
      return;
    }
    if (!name.trim()) {
      setFormError("Give this plan a name so you can find it later.");
      return;
    }
    if (
      startTerm &&
      endTerm &&
      terms.findIndex((term) => term.id === startTerm) >
        terms.findIndex((term) => term.id === endTerm)
    ) {
      setFormError("The last semester must be after the first semester.");
      return;
    }
    onSave({
      id: initialPlan?.id ?? crypto.randomUUID(),
      name: name.trim(),
      major,
      minor,
      startTerm,
      endTerm,
      courses: initialPlan?.courses ?? [],
    });
  }

  return (
    <section className="plan-setup-page">
      <button className="back-link" type="button" onClick={onCancel}>
        <span aria-hidden="true">←</span> Back to plans
      </button>
      <div className="plan-setup-layout">
        <div className="plan-setup-intro">
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1>{initialPlan ? "Edit your plan" : "Create a graduation plan"}</h1>
          <p className="student-copy">
            Choose a program and set up a path you can build on. You can change
            these details later.
          </p>
          <div className="setup-aside-note">
            <span className="setup-aside-mark" aria-hidden="true">
              ✦
            </span>
            <p>
              Make another plan to compare a different major, minor, or course
              path.
            </p>
          </div>
        </div>

        <form className="plan-setup-form" onSubmit={handleSubmit}>
          <div className="setup-form-heading">
            <span>01</span>
            <div>
              <h2>Plan details</h2>
              <p>Start with a name and your degree program.</p>
            </div>
          </div>
          <label className="setup-field" htmlFor="plan-name">
            Plan name <span>Give this path a name</span>
            <input
              id="plan-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Computer Science, lighter course load"
              maxLength={80}
              required
            />
          </label>
          <ProgramPicker
            label="Major"
            help="Required"
            degreeType="BACHELOR"
            selected={major}
            onChange={(program) => {
              setMajor(program);
              if (program && !name.trim()) setName(`${program.name} Plan`);
            }}
          />
          {minorVisible ? (
            <div className="minor-picker-row">
              <ProgramPicker
                label="Minor"
                help="Optional"
                degreeType="MINOR"
                selected={minor}
                onChange={setMinor}
              />
              <button
                className="remove-minor-button"
                type="button"
                onClick={() => {
                  setMinor(null);
                  setMinorVisible(false);
                }}
              >
                Remove minor
              </button>
            </div>
          ) : (
            <button
              className="add-minor-button"
              type="button"
              onClick={() => setMinorVisible(true)}
            >
              <span aria-hidden="true">+</span> Add a minor{" "}
              <small>Optional</small>
            </button>
          )}

          <div className="semester-fields">
            <div className="setup-form-heading semester-heading">
              <span>02</span>
              <div>
                <h2>
                  Semester range <small>Optional</small>
                </h2>
                <p>Set a target window or leave these open for now.</p>
              </div>
            </div>
            <div className="semester-select-grid">
              <label className="setup-field" htmlFor="start-semester">
                First semester
                <select
                  id="start-semester"
                  value={startTerm}
                  onChange={(event) => setStartTerm(event.target.value)}
                >
                  <option value="">Choose later</option>
                  {terms.map((term) => (
                    <option value={term.id} key={term.id}>
                      {term.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="setup-field" htmlFor="end-semester">
                Last semester
                <select
                  id="end-semester"
                  value={endTerm}
                  onChange={(event) => setEndTerm(event.target.value)}
                >
                  <option value="">Choose later</option>
                  {terms.map((term) => (
                    <option value={term.id} key={term.id}>
                      {term.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {formError && (
            <p className="error-message setup-error">{formError}</p>
          )}
          <div className="setup-form-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit">
              {initialPlan ? "Save changes" : "Create and open plan"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
