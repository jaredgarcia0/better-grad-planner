import {
  useEffect, useId, useMemo, useRef, useState,
  type CSSProperties, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  appendDashboardRow, changeDashboardRowPreset, cloneDashboardLayout,
  createDefaultDashboardLayout, dashboardGridColumns, DASHBOARD_PRESETS,
  DASHBOARD_WIDGET_LABELS, DASHBOARD_WIDGETS, MAX_DASHBOARD_ROWS,
  normalizeDashboardLayout,
  type DashboardLayout, type DashboardPresetId, type DashboardWidgetType,
} from "../dashboardLayout";
import "../dashboard.css";

export type DashboardProps = {
  layout: DashboardLayout;
  onSave: (layout: DashboardLayout) => Promise<void>;
  renderWidget: (widget: DashboardWidgetType) => ReactNode;
  planId: string;
};

/** App dispatches a cancelable window Event before navigation and checks dispatchEvent's result. */
export const DASHBOARD_BEFORE_NAVIGATE_EVENT = "dashboard:before-navigate";

const widgetDescriptions: Record<DashboardWidgetType, string> = {
  planner: "Your courses, organized by term.",
  requirements: "Keep your degree requirements in view.",
  "course-search": "Find the next course for your plan.",
  notes: "A little space for ideas and reminders.",
  progress: "See the credits and courses you have planned.",
  prerequisites: "Keep an eye on what comes first.",
};

function LayoutThumbnail({ preset }: { preset: DashboardPresetId }) {
  return (
    <span className="dashboard-thumbnail" aria-hidden="true"
      style={{ gridTemplateColumns: dashboardGridColumns(preset) }}>
      {DASHBOARD_PRESETS.find((item) => item.id === preset)!.fractions.map((_, index) => (
        <span key={index}><i /><i /><i /></span>
      ))}
    </span>
  );
}

function LayoutPicker({ rowNumber, selected, onSelect, onClose, fallbackFocus }: {
  rowNumber: number;
  selected?: DashboardPresetId;
  onSelect: (preset: DashboardPresetId) => void;
  onClose: () => void;
  fallbackFocus: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
      else fallbackFocus.current?.focus();
    };
  }, [fallbackFocus]);

  return createPortal(
    <dialog ref={dialogRef} className="dashboard-modal" aria-labelledby={titleId}
      aria-describedby={descriptionId} aria-modal="true"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}>
      <div className="dashboard-modal__heading">
        <div>
          <p className="dashboard-eyebrow">Make room for what matters</p>
          <h2 id={titleId}>Choose a row layout</h2>
        </div>
        <button type="button" className="dashboard-button dashboard-button--icon"
          aria-label="Close layout selection" onClick={onClose}>×</button>
      </div>
      <p id={descriptionId} className="dashboard-description">
        Pick the column sizes for row {rowNumber}. You can choose a widget for each space.
      </p>
      <div className="dashboard-presets">
        {DASHBOARD_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className="dashboard-preset"
            aria-pressed={selected === preset.id} onClick={() => onSelect(preset.id)}>
            <LayoutThumbnail preset={preset.id} />
            <span>{preset.label}</span>
            {selected === preset.id && <span className="dashboard-preset__selected">Current layout</span>}
          </button>
        ))}
      </div>
      <div className="dashboard-modal__footer">
        <button type="button" className="dashboard-button" onClick={onClose}>Cancel</button>
      </div>
    </dialog>, document.body,
  );
}

/** A plan-keyed session keeps drafts and in-flight saves from leaking into another plan. */
export function Dashboard(props: DashboardProps) {
  return <DashboardSession key={props.planId} {...props} />;
}

function DashboardSession({ layout, onSave, renderWidget, planId }: DashboardProps) {
  const normalized = useMemo(() => normalizeDashboardLayout(layout), [layout]);
  // Keep the successful result visible even if the parent publishes it one render later.
  const [committed, setCommitted] = useState<{ source: DashboardLayout; value: DashboardLayout } | null>(null);
  const visible = committed?.source === layout ? committed.value : normalized;
  const [draft, setDraft] = useState<DashboardLayout | null>(null);
  const [baseline, setBaseline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [picker, setPicker] = useState<{ rowId: string | null } | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const wasEditing = useRef(false);
  const headingId = useId();
  const instanceId = useId();
  const dirty = draft !== null && JSON.stringify(draft) !== baseline;
  const current = draft ?? visible;
  const usedWidgets = new Set(current.rows.flatMap((row) => row.columns.flatMap((column) => column.widget ? [column.widget] : [])));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (draft) cancelButton.current?.focus();
    else if (wasEditing.current) editButton.current?.focus();
    wasEditing.current = draft !== null;
    // Focus only when entering or leaving editing, not while rearranging rows.
  }, [draft !== null]);

  useEffect(() => {
    if (!dirty && !saving) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function beforeNavigate(event: Event) {
      if (savingRef.current) {
        event.preventDefault();
        setAnnouncement("Please wait for your dashboard to finish saving.");
      } else if (dirty && !window.confirm("Discard unsaved dashboard changes?")) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener(DASHBOARD_BEFORE_NAVIGATE_EVENT, beforeNavigate);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener(DASHBOARD_BEFORE_NAVIGATE_EVENT, beforeNavigate);
    };
  }, [dirty, saving]);

  function updateDraft(next: DashboardLayout, message?: string) {
    if (savingRef.current) return;
    setDraft(next);
    setError(null);
    if (message) setAnnouncement(message);
  }

  function startEditing() {
    setBaseline(JSON.stringify(visible));
    setDraft(cloneDashboardLayout(visible));
    setError(null);
    setAnnouncement("Editing dashboard. Choose layouts and widgets, then save your changes.");
  }

  function cancelEditing() {
    if (savingRef.current) return;
    if (dirty && !window.confirm("Discard unsaved dashboard changes?")) return;
    setDraft(null);
    setPicker(null);
    setError(null);
    setAnnouncement("Dashboard changes discarded.");
  }

  async function save() {
    if (!draft || savingRef.current || !dirty) return;
    const snapshot = cloneDashboardLayout(draft);
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      // Give the caller its own copy, so a mutation there cannot change the draft.
      await onSave(cloneDashboardLayout(snapshot));
      if (!mounted.current) return;
      setCommitted({ source: layout, value: snapshot });
      setDraft(null);
      setPicker(null);
      setAnnouncement("Dashboard saved.");
    } catch {
      if (mounted.current) setError("Your dashboard couldn’t be saved. Your changes are still here. Please try again.");
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  function selectPreset(preset: DashboardPresetId) {
    if (!draft || !picker || savingRef.current) return;
    if (picker.rowId === null) {
      if (draft.rows.length >= MAX_DASHBOARD_ROWS) return;
      updateDraft(appendDashboardRow(draft, preset), "Row added. Choose a widget for each space.");
    } else {
      const result = changeDashboardRowPreset(draft, picker.rowId, preset);
      if (result.removedWidgets.length && !window.confirm(
        `This layout will remove ${result.removedWidgets.map((widget) => DASHBOARD_WIDGET_LABELS[widget]).join(", ")} from your dashboard. Continue?`,
      )) return;
      updateDraft(result.layout, "Row layout updated.");
    }
    setPicker(null);
  }

  function moveRow(rowId: string, direction: -1 | 1) {
    if (!draft || savingRef.current) return;
    const next = cloneDashboardLayout(draft);
    const from = next.rows.findIndex((row) => row.id === rowId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= next.rows.length) return;
    [next.rows[from], next.rows[to]] = [next.rows[to], next.rows[from]];
    updateDraft(next, `Row moved to position ${to + 1}.`);
  }

  function removeRow(rowId: string) {
    if (!draft || savingRef.current) return;
    const row = draft.rows.find((item) => item.id === rowId);
    if (!row) return;
    if (row.columns.some((column) => column.widget) && !window.confirm(
      "Delete this row and remove its widgets from your dashboard?",
    )) return;
    updateDraft({ ...draft, rows: draft.rows.filter((item) => item.id !== rowId) }, "Row deleted.");
    addButton.current?.focus();
  }

  function chooseWidget(columnId: string, value: string) {
    if (!draft || savingRef.current) return;
    const widget = value === "" ? null : DASHBOARD_WIDGETS.find((item) => item === value);
    if (widget === undefined) return;
    if (widget && draft.rows.some((row) => row.columns.some((column) => column.id !== columnId && column.widget === widget))) return;
    const next = cloneDashboardLayout(draft);
    for (const row of next.rows) {
      const column = row.columns.find((item) => item.id === columnId);
      if (column) column.widget = widget;
    }
    updateDraft(next, widget ? `${DASHBOARD_WIDGET_LABELS[widget]} added.` : "Space cleared.");
  }

  const pickerRow = picker?.rowId ? draft?.rows.find((row) => row.id === picker.rowId) : undefined;

  return (
    <section className={`dashboard${draft ? " dashboard--editing" : ""}`}
      data-plan-id={planId} aria-labelledby={headingId} aria-busy={saving}>
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Your space, your way</p>
          <h2 id={headingId}>{draft ? "Make this dashboard yours" : "Your dashboard"}</h2>
          <p className="dashboard-description">
            {draft ? "Arrange your rows and choose what you want to see." : "Everything you need for the path ahead."}
          </p>
        </div>
        {draft ? (
          <div className="dashboard-actions">
            <button ref={cancelButton} type="button" className="dashboard-button" disabled={saving} onClick={cancelEditing}>Cancel</button>
            <button type="button" className="dashboard-button dashboard-button--primary"
              disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? "Saving…" : error ? "Try saving again" : "Save dashboard"}
            </button>
          </div>
        ) : (
          <button ref={editButton} type="button" className="dashboard-button" onClick={startEditing}>Edit dashboard</button>
        )}
      </header>

      <p className="dashboard-sr-only" role="status" aria-live="polite">{announcement}</p>
      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {draft && (
        <div className="dashboard-edit-summary">
          <span>{dirty ? "Unsaved changes" : "Ready to arrange"}</span>
          <span>{current.rows.length} of {MAX_DASHBOARD_ROWS} rows · Each widget can appear once</span>
        </div>
      )}

      <div className="dashboard-rows">
        {current.rows.map((row, rowIndex) => (
          <section className="dashboard-row" key={row.id}
            aria-label={`Row ${rowIndex + 1}`}>
            {draft && (
              <div className="dashboard-row__toolbar">
                <div className="dashboard-row__title">
                  <span className="dashboard-row__number">{String(rowIndex + 1).padStart(2, "0")}</span>
                  <span>Row {rowIndex + 1}</span>
                  <button type="button" className="dashboard-button dashboard-button--layout" disabled={saving}
                    aria-label={`Change layout for row ${rowIndex + 1}`} aria-haspopup="dialog"
                    onClick={() => setPicker({ rowId: row.id })}>
                    <LayoutThumbnail preset={row.layout} />
                    <span>{DASHBOARD_PRESETS.find((item) => item.id === row.layout)!.label}</span>
                    <span aria-hidden="true">⌄</span>
                  </button>
                </div>
                <div className="dashboard-actions">
                  <button type="button" className="dashboard-button dashboard-button--icon"
                    aria-label={`Move row ${rowIndex + 1} up`} title="Move row up"
                    disabled={saving || rowIndex === 0} onClick={() => moveRow(row.id, -1)}>↑</button>
                  <button type="button" className="dashboard-button dashboard-button--icon"
                    aria-label={`Move row ${rowIndex + 1} down`} title="Move row down"
                    disabled={saving || rowIndex === current.rows.length - 1} onClick={() => moveRow(row.id, 1)}>↓</button>
                  <button type="button" className="dashboard-button dashboard-button--danger"
                    aria-label={`Delete row ${rowIndex + 1}`} disabled={saving} onClick={() => removeRow(row.id)}>Delete</button>
                </div>
              </div>
            )}
            <div className="dashboard-row__grid"
              style={{ "--dashboard-columns": dashboardGridColumns(row.layout) } as CSSProperties}>
              {row.columns.map((column, columnIndex) => (
                <div key={column.id} className="dashboard-cell">
                  {draft ? (
                    <div className={`dashboard-slot${column.widget ? " dashboard-slot--filled" : ""}`}>
                      <span className="dashboard-slot__icon" aria-hidden="true">{column.widget ? "▤" : "+"}</span>
                      <strong>{column.widget ? DASHBOARD_WIDGET_LABELS[column.widget] : "A little room for more"}</strong>
                      <p>{column.widget ? widgetDescriptions[column.widget] : "Choose what belongs here."}</p>
                      <label className="dashboard-slot__label" htmlFor={`${instanceId}-${column.id}`}>
                        Widget <span className="dashboard-sr-only">for row {rowIndex + 1}, column {columnIndex + 1}</span>
                      </label>
                      <select id={`${instanceId}-${column.id}`} className="dashboard-select" disabled={saving}
                        value={column.widget ?? ""} onChange={(event) => chooseWidget(column.id, event.target.value)}>
                        <option value="">Empty space</option>
                        {DASHBOARD_WIDGETS.map((widget) => (
                          <option key={widget} value={widget} disabled={usedWidgets.has(widget) && column.widget !== widget}>
                            {DASHBOARD_WIDGET_LABELS[widget]}{usedWidgets.has(widget) && column.widget !== widget ? " — already on dashboard" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : column.widget ? (
                    <div className="dashboard-widget" data-widget={column.widget}>
                      {renderWidget(column.widget)}
                    </div>
                  ) : <div className="dashboard-empty-slot" aria-label="Empty dashboard space" />}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {current.rows.length === 0 && (
        <div className="dashboard-empty">
          <span aria-hidden="true">▦</span>
          <h3>A fresh start</h3>
          <p>{draft ? "Add your first row and make room for your plan." : "Edit your dashboard to add the widgets you want to see."}</p>
        </div>
      )}
      {draft && (
        <div className="dashboard-edit-footer">
          <button ref={addButton} type="button" className="dashboard-add-row" aria-haspopup="dialog"
            disabled={saving || current.rows.length >= MAX_DASHBOARD_ROWS} onClick={() => setPicker({ rowId: null })}>
            <span aria-hidden="true">＋</span> {current.rows.length >= MAX_DASHBOARD_ROWS ? "Row limit reached" : "Add row"}
          </button>
          <button type="button" className="dashboard-reset" disabled={saving} onClick={() => {
            if (window.confirm("Restore the default dashboard? This will replace the rows and widgets in your draft.")) {
              updateDraft(createDefaultDashboardLayout(), "Default layout restored. Save to keep it.");
            }
          }}>Restore default layout</button>
        </div>
      )}

      {picker && draft && (
        <LayoutPicker rowNumber={pickerRow ? draft.rows.indexOf(pickerRow) + 1 : draft.rows.length + 1}
          selected={pickerRow?.layout} onSelect={selectPreset} onClose={() => setPicker(null)} fallbackFocus={addButton} />
      )}
    </section>
  );
}
