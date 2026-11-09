export type DashboardWidgetType =
  | "planner"
  | "requirements"
  | "course-search"
  | "notes"
  | "progress"
  | "prerequisites";

export type DashboardPresetId =
  | "full"
  | "halves"
  | "thirds"
  | "third-two-thirds"
  | "two-thirds-third"
  | "three-quarters-quarter"
  | "quarter-three-quarters"
  | "quarter-half-quarter"
  | "quarter-quarter-half"
  | "half-quarter-quarter"
  | "quarters";

export type DashboardColumn = { id: string; widget: DashboardWidgetType | null };
export type DashboardRow = {
  id: string;
  layout: DashboardPresetId;
  columns: DashboardColumn[];
};
export type DashboardLayout = { version: 1; rows: DashboardRow[] };

export const MAX_DASHBOARD_ROWS = 20;
export const DASHBOARD_WIDGETS: readonly DashboardWidgetType[] = [
  "planner", "requirements", "course-search", "notes", "progress", "prerequisites",
];
export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetType, string> = {
  planner: "Planner",
  requirements: "Requirements",
  "course-search": "Course search",
  notes: "Notes",
  progress: "Credit summary",
  prerequisites: "Prerequisites",
};

export const DASHBOARD_PRESETS: readonly {
  id: DashboardPresetId;
  label: string;
  fractions: readonly number[];
}[] = [
  { id: "full", label: "Full width", fractions: [1] },
  { id: "halves", label: "Two halves", fractions: [1, 1] },
  { id: "thirds", label: "Three thirds", fractions: [1, 1, 1] },
  { id: "third-two-thirds", label: "One third · Two thirds", fractions: [1, 2] },
  { id: "two-thirds-third", label: "Two thirds · One third", fractions: [2, 1] },
  { id: "three-quarters-quarter", label: "Three quarters · One quarter", fractions: [3, 1] },
  { id: "quarter-three-quarters", label: "One quarter · Three quarters", fractions: [1, 3] },
  { id: "quarter-half-quarter", label: "Quarter · Half · Quarter", fractions: [1, 2, 1] },
  { id: "quarter-quarter-half", label: "Quarter · Quarter · Half", fractions: [1, 1, 2] },
  { id: "half-quarter-quarter", label: "Half · Quarter · Quarter", fractions: [2, 1, 1] },
  { id: "quarters", label: "Four quarters", fractions: [1, 1, 1, 1] },
];

export function dashboardGridColumns(preset: DashboardPresetId): string {
  return DASHBOARD_PRESETS.find((item) => item.id === preset)!.fractions
    .map((fraction) => `minmax(0, ${fraction}fr)`).join(" ");
}

export function createDefaultDashboardLayout(): DashboardLayout {
  return {
    version: 1,
    rows: [
      {
        id: "dashboard-row-planner", layout: "full",
        columns: [{ id: "dashboard-column-planner", widget: "planner" }],
      },
      {
        id: "dashboard-row-courses", layout: "halves",
        columns: [
          { id: "dashboard-column-search", widget: "course-search" },
          { id: "dashboard-column-requirements", widget: "requirements" },
        ],
      },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Invalid input is rejected as a whole; valid input is copied into a fresh tree. */
export function normalizeDashboardLayout(value: unknown): DashboardLayout {
  const fallback = createDefaultDashboardLayout;
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.rows)
    || value.rows.length > MAX_DASHBOARD_ROWS) return fallback();

  const ids = new Set<string>();
  const widgets = new Set<DashboardWidgetType>();
  const rows: DashboardRow[] = [];
  function takeId(id: unknown): id is string {
    if (typeof id !== "string" || !id.trim() || id.length > 80 || ids.has(id)) return false;
    ids.add(id);
    return true;
  }
  for (const row of value.rows) {
    if (!isRecord(row) || !takeId(row.id)) return fallback();
    const preset = DASHBOARD_PRESETS.find((item) => item.id === row.layout);
    if (!preset || !Array.isArray(row.columns)
      || row.columns.length !== preset.fractions.length) return fallback();
    const columns: DashboardColumn[] = [];
    for (const column of row.columns) {
      if (!isRecord(column) || !takeId(column.id)) return fallback();
      const widget = column.widget;
      if (widget !== null) {
        if (!DASHBOARD_WIDGETS.includes(widget as DashboardWidgetType)
          || widgets.has(widget as DashboardWidgetType)) return fallback();
        widgets.add(widget as DashboardWidgetType);
      }
      columns.push({ id: column.id, widget: widget as DashboardWidgetType | null });
    }
    rows.push({ id: row.id, layout: preset.id, columns });
  }
  return { version: 1, rows };
}

export function cloneDashboardLayout(layout: DashboardLayout): DashboardLayout {
  return {
    version: 1,
    rows: layout.rows.map((row) => ({
      ...row, columns: row.columns.map((column) => ({ ...column })),
    })),
  };
}

function idAllocator(layout: DashboardLayout) {
  const used = new Set(layout.rows.flatMap((row) => [row.id, ...row.columns.map((column) => column.id)]));
  return (kind: "row" | "column") => {
    let number = 1;
    while (used.has(`dashboard-${kind}-${number}`)) number++;
    const id = `dashboard-${kind}-${number}`;
    used.add(id);
    return id;
  };
}

export function appendDashboardRow(layout: DashboardLayout, preset: DashboardPresetId): DashboardLayout {
  if (layout.rows.length >= MAX_DASHBOARD_ROWS) return cloneDashboardLayout(layout);
  const nextId = idAllocator(layout);
  const row: DashboardRow = {
    id: nextId("row"), layout: preset,
    columns: DASHBOARD_PRESETS.find((item) => item.id === preset)!.fractions
      .map(() => ({ id: nextId("column"), widget: null })),
  };
  const next = cloneDashboardLayout(layout);
  next.rows.push(row);
  return next;
}

/** Fill retained empty slots before removing any widgets. Surviving column IDs stay stable. */
export function changeDashboardRowPreset(
  layout: DashboardLayout, rowId: string, preset: DashboardPresetId,
): { layout: DashboardLayout; removedWidgets: DashboardWidgetType[] } {
  const next = cloneDashboardLayout(layout);
  const row = next.rows.find((item) => item.id === rowId);
  if (!row) return { layout: next, removedWidgets: [] };
  const count = DASHBOARD_PRESETS.find((item) => item.id === preset)!.fractions.length;
  const nextId = idAllocator(layout);
  const columns = row.columns.slice(0, count);
  const displaced = row.columns.slice(count).flatMap((column) => column.widget ? [column.widget] : []);
  for (const column of columns) {
    if (column.widget === null && displaced.length) column.widget = displaced.shift()!;
  }
  while (columns.length < count) columns.push({ id: nextId("column"), widget: null });
  row.layout = preset;
  row.columns = columns;
  return { layout: next, removedWidgets: displaced };
}
