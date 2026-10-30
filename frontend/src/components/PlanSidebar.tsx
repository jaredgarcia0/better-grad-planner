import { useState, type MouseEvent } from "react";
import type { DegreePlan, User } from "../api/client";

type PlanSidebarProps = {
  plans: DegreePlan[];
  activePlanId: string | null;
  activeView: "planner" | "notes";
  user: User;
  onNavigate: (href: string) => void;
  onCreatePlan: () => void;
  onDeletePlan: (plan: DegreePlan) => void;
  onSignOut: () => void;
};

function getInitials(email: string) {
  const accountName = email.split("@", 1)[0] ?? "";
  const parts = accountName.split(/[._-]+/).filter(Boolean);

  if (parts.length > 1) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return accountName.slice(0, 2).toUpperCase() || "U";
}

function shouldHandleNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.currentTarget.target !== "_blank"
  );
}

export function PlanSidebar({
  plans,
  activePlanId,
  activeView,
  user,
  onNavigate,
  onCreatePlan,
  onDeletePlan,
  onSignOut,
}: PlanSidebarProps) {
  const [plansOpen, setPlansOpen] = useState(true);
  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? null;

  function handleNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (!shouldHandleNavigation(event)) return;

    event.preventDefault();
    onNavigate(event.currentTarget.getAttribute("href") ?? "/plans");
  }

  return (
    <aside className="plan-sidebar" aria-label="Grad planner sidebar">
      <div className="plan-sidebar__header">
        <a
          className="plan-sidebar__brand"
          href="/plans"
          onClick={handleNavigation}
          aria-label="Better Grad Planner plans"
        >
          <span className="plan-sidebar__brand-mark" aria-hidden="true">
            B
          </span>
          <span>Better Grad Planner</span>
        </a>
      </div>

      <nav className="plan-sidebar__nav" aria-label="Graduation plans">
        <section className="plan-sidebar__section">
          <button
            className="plan-sidebar__section-toggle"
            type="button"
            aria-expanded={plansOpen}
            aria-controls="plan-sidebar-plan-list"
            onClick={() => setPlansOpen((open) => !open)}
          >
            <span>Grad plans</span>
            <span
              className={`plan-sidebar__chevron${plansOpen ? " is-open" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          {plansOpen && (
            <div id="plan-sidebar-plan-list" className="plan-sidebar__plans">
              {plans.length > 0 ? (
                <ul className="plan-sidebar__plan-list">
                  {plans.map((plan) => {
                    const isActivePlan = plan.id === activePlanId;
                    const plannerHref = `/plans/${plan.id}`;
                    const notesHref = `${plannerHref}/notes`;

                    return (
                      <li
                        className={`plan-sidebar__plan${isActivePlan ? " is-active-plan" : ""}`}
                        key={plan.id}
                      >
                        <div className="plan-sidebar__plan-row">
                          <a
                            className={`plan-sidebar__plan-link${
                              isActivePlan && activeView === "planner"
                                ? " is-active-view"
                                : ""
                            }`}
                            href={plannerHref}
                            onClick={handleNavigation}
                            aria-current={
                              isActivePlan && activeView === "planner"
                                ? "page"
                                : undefined
                            }
                          >
                            <span className="plan-sidebar__plan-name">
                              {plan.name}
                            </span>
                          </a>
                          <a
                            className="plan-sidebar__new-tab"
                            href={plannerHref}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${plan.name} in a new tab`}
                            title="Open plan in a new tab"
                          >
                            <span aria-hidden="true">↗</span>
                          </a>
                          <button
                            className="plan-sidebar__delete"
                            type="button"
                            onClick={() => onDeletePlan(plan)}
                            aria-label={`Delete ${plan.name}`}
                            title="Delete plan"
                          >
                            <span aria-hidden="true">⌫</span>
                          </button>
                        </div>

                        <a
                          className={`plan-sidebar__notes-link${
                            isActivePlan && activeView === "notes"
                              ? " is-active-view"
                              : ""
                          }`}
                          href={notesHref}
                          onClick={handleNavigation}
                          aria-current={
                            isActivePlan && activeView === "notes"
                              ? "page"
                              : undefined
                          }
                        >
                          <span aria-hidden="true">▤</span>
                          Notes
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="plan-sidebar__empty">No grad plans yet.</p>
              )}

              <button
                className="plan-sidebar__create-button"
                type="button"
                onClick={onCreatePlan}
              >
                <span aria-hidden="true">+</span>
                Create plan
              </button>
            </div>
          )}
        </section>

        {activePlan && (
          <div className="plan-sidebar__active-plan" aria-live="polite">
            <span>Current plan</span>
            <strong>{activePlan.name}</strong>
          </div>
        )}
      </nav>

      <div className="plan-sidebar__account">
        <div className="plan-sidebar__profile">
          <span className="plan-sidebar__avatar" aria-hidden="true">
            {getInitials(user.email)}
          </span>
          <div className="plan-sidebar__profile-copy">
            <strong>My account</strong>
            <span title={user.email}>{user.email}</span>
          </div>
        </div>
        <button
          className="plan-sidebar__sign-out"
          type="button"
          onClick={onSignOut}
        >
          Sign out
          <span aria-hidden="true">↪</span>
        </button>
      </div>
    </aside>
  );
}
