// Run from the repository root (the loader also works where tsx CLI IPC is restricted):
// node --import ./backend/node_modules/tsx/dist/loader.mjs --test frontend/tests/dashboardLayout.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  appendDashboardRow, changeDashboardRowPreset, cloneDashboardLayout,
  createDefaultDashboardLayout, dashboardGridColumns, DASHBOARD_PRESETS,
  DASHBOARD_WIDGETS, MAX_DASHBOARD_ROWS, normalizeDashboardLayout,
  type DashboardLayout, type DashboardPresetId, type DashboardRow,
} from "../src/dashboardLayout.ts";

const empty = (): DashboardLayout => ({ version: 1, rows: [] });
const row = (id = "row", layout: DashboardPresetId = "full"): DashboardRow => ({
  id, layout,
  columns: DASHBOARD_PRESETS.find((preset) => preset.id === layout)!.fractions
    .map((_, index) => ({ id: `${id}-column-${index}`, widget: null })),
});

function assertRejected(value: unknown) {
  const actual = normalizeDashboardLayout(value);
  assert.deepEqual(actual, createDefaultDashboardLayout());
  actual.rows[0].columns[0].widget = null;
  assert.equal(createDefaultDashboardLayout().rows[0].columns[0].widget, "planner");
}

test("defaults match the existing planner, course search and requirements order with stable fresh IDs", () => {
  const first = createDefaultDashboardLayout();
  const second = createDefaultDashboardLayout();
  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((item) => [item.layout, item.columns.map((column) => column.widget)]), [
    ["full", ["planner"]], ["halves", ["course-search", "requirements"]],
  ]);
  const ids = first.rows.flatMap((item) => [item.id, ...item.columns.map((column) => column.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert.notEqual(first.rows[0].columns[0], second.rows[0].columns[0]);
  assert.deepEqual(normalizeDashboardLayout(first), first);
});

test("an intentionally empty dashboard remains empty", () => {
  assert.deepEqual(normalizeDashboardLayout(empty()), empty());
});

test("valid input is deeply copied and unknown fields are discarded", () => {
  const source = { ...createDefaultDashboardLayout(), extra: "discard" };
  const result = normalizeDashboardLayout(source);
  assert.equal("extra" in result, false);
  assert.notEqual(result.rows, source.rows);
  assert.notEqual(result.rows[0], source.rows[0]);
  assert.notEqual(result.rows[0].columns, source.rows[0].columns);
  result.rows[0].columns[0].widget = "notes";
  assert.equal(source.rows[0].columns[0].widget, "planner");
});

test("malformed roots, versions, rows, presets and slots fall back as a whole", () => {
  const bad: unknown[] = [
    undefined, null, false, "dashboard", [], {},
    { version: "1", rows: [] }, { version: 2, rows: [] }, { version: true, rows: [] },
    { version: 1 }, { version: 1, rows: {} },
    { version: 1, rows: [null] }, { version: 1, rows: [undefined] },
    { version: 1, rows: [new Array(1)] },
    { version: 1, rows: [{ ...row(), layout: "unknown" }] },
    { version: 1, rows: [{ ...row(), columns: null }] },
    { version: 1, rows: [{ ...row(), columns: [] }] },
    { version: 1, rows: [{ ...row(), columns: [null] }] },
    { version: 1, rows: [{ ...row(), columns: [{ id: "column" }] }] },
    { version: 1, rows: [{ ...row(), columns: [{ id: "column", widget: "unknown" }] }] },
    { version: 1, rows: [{ ...row(), columns: [{ id: "column", widget: false }] }] },
    { version: 1, rows: new Array(1) },
    { version: 1, rows: [{ ...row(), columns: new Array(1) }] },
  ];
  for (const value of bad) assertRejected(value);
});

test("each preset requires its exact number of columns and renders its specified ratio", () => {
  const expected = {
    full: [1], halves: [1, 1], thirds: [1, 1, 1],
    "third-two-thirds": [1, 2], "two-thirds-third": [2, 1],
    "three-quarters-quarter": [3, 1], "quarter-three-quarters": [1, 3],
    "quarter-half-quarter": [1, 2, 1], "quarter-quarter-half": [1, 1, 2],
    "half-quarter-quarter": [2, 1, 1], quarters: [1, 1, 1, 1],
  };
  assert.equal(DASHBOARD_PRESETS.length, 11);
  for (const [id, ratio] of Object.entries(expected)) {
    const preset = id as DashboardPresetId;
    const valid: DashboardLayout = { version: 1, rows: [row("row", preset)] };
    assert.deepEqual(normalizeDashboardLayout(valid), valid);
    assert.equal(dashboardGridColumns(preset), ratio.map((n) => `minmax(0, ${n}fr)`).join(" "));
    assertRejected({ version: 1, rows: [{ ...valid.rows[0], columns: [...valid.rows[0].columns, { id: "extra", widget: null }] }] });
    assertRejected({ version: 1, rows: [{ ...valid.rows[0], columns: valid.rows[0].columns.slice(1) }] });
  }
});

test("row and column IDs share a global uniqueness constraint", () => {
  const first = row("first", "halves");
  const second = row("second");
  assertRejected({ version: 1, rows: [first, { ...second, id: first.id }] });
  assertRejected({ version: 1, rows: [first, { ...second, id: first.columns[0].id }] });
  assertRejected({ version: 1, rows: [{ ...first, columns: [{ id: first.id, widget: null }, first.columns[1]] }] });
  assertRejected({ version: 1, rows: [first, { ...second, columns: [{ id: first.columns[0].id, widget: null }] }] });
});

test("IDs must be nonblank strings of at most 80 characters", () => {
  for (const id of ["", "  ", "\n\t", "x".repeat(81), 4, null, undefined]) {
    assertRejected({ version: 1, rows: [{ ...row(), id }] });
    assertRejected({ version: 1, rows: [{ ...row(), columns: [{ id, widget: null }] }] });
  }
  const valid: DashboardLayout = { version: 1, rows: [{ ...row("r".repeat(80)), columns: [{ id: "c".repeat(80), widget: null }] }] };
  assert.deepEqual(normalizeDashboardLayout(valid), valid);
});

test("all six widgets are allowed, but nonempty duplicates in or across rows reject the layout", () => {
  const valid: DashboardLayout = {
    version: 1,
    rows: DASHBOARD_WIDGETS.map((widget, index) => ({ ...row(`r${index}`), columns: [{ id: `c${index}`, widget }] })),
  };
  assert.deepEqual(normalizeDashboardLayout(valid), valid);
  assertRejected({ ...valid, rows: [...valid.rows, { ...row("duplicate"), columns: [{ id: "duplicate-column", widget: "planner" }] }] });
  assertRejected({ version: 1, rows: [{ ...row("r", "halves"), columns: [{ id: "a", widget: "notes" }, { id: "b", widget: "notes" }] }] });
  assert.deepEqual(normalizeDashboardLayout({ version: 1, rows: [row("r", "quarters")] }), { version: 1, rows: [row("r", "quarters")] });
});

test("20 rows are valid, a 21st row is rejected and adding at capacity makes no change", () => {
  const full: DashboardLayout = { version: 1, rows: Array.from({ length: MAX_DASHBOARD_ROWS }, (_, index) => row(`r${index}`)) };
  assert.deepEqual(normalizeDashboardLayout(full), full);
  assertRejected({ ...full, rows: [...full.rows, row("overflow")] });
  assert.deepEqual(appendDashboardRow(full, "quarters"), full);
  assert.notEqual(appendDashboardRow(full, "full"), full);
});

test("new rows and expansions allocate IDs safely even when imported IDs use generated names", () => {
  const source: DashboardLayout = { version: 1, rows: [{ id: "dashboard-column-1", layout: "full", columns: [{ id: "dashboard-row-1", widget: null }] }] };
  const original = cloneDashboardLayout(source);
  const added = appendDashboardRow(source, "quarters");
  assert.equal(added.rows.length, 2);
  assert.deepEqual(normalizeDashboardLayout(added), added);
  assert.deepEqual(source, original);
  const expanded = changeDashboardRowPreset(added, source.rows[0].id, "quarters");
  assert.deepEqual(normalizeDashboardLayout(expanded.layout), expanded.layout);
  assert.deepEqual(expanded.removedWidgets, []);
});

test("shrinking relocates displaced widgets into empty retained slots before reporting removals", () => {
  const source: DashboardLayout = { version: 1, rows: [{
    id: "r", layout: "quarters", columns: [
      { id: "a", widget: null }, { id: "b", widget: "notes" },
      { id: "c", widget: "planner" }, { id: "d", widget: "progress" },
    ],
  }] };
  const original = cloneDashboardLayout(source);
  const result = changeDashboardRowPreset(source, "r", "halves");
  assert.deepEqual(result.layout.rows[0].columns, [{ id: "a", widget: "planner" }, { id: "b", widget: "notes" }]);
  assert.deepEqual(result.removedWidgets, ["progress"]);
  assert.deepEqual(source, original);
  const single = changeDashboardRowPreset({ version: 1, rows: [{ ...source.rows[0], columns: source.rows[0].columns.map((column) => ({ ...column, widget: column.id === "d" ? "progress" : null })) }] }, "r", "full");
  assert.deepEqual(single.layout.rows[0].columns, [{ id: "a", widget: "progress" }]);
  assert.deepEqual(single.removedWidgets, []);
});

test("every preset transition preserves as many widgets as fit and keeps valid independent trees", () => {
  for (const before of DASHBOARD_PRESETS) {
    // Exercise empty spaces in every position, including fully empty and fully occupied rows.
    for (let mask = 0; mask < 2 ** before.fractions.length; mask++) {
      const source: DashboardLayout = { version: 1, rows: [row("r", before.id)] };
      source.rows[0].columns.forEach((column, index) => {
        column.widget = mask & (1 << index) ? DASHBOARD_WIDGETS[index] : null;
      });
      const snapshot = cloneDashboardLayout(source);
      const originalWidgets = source.rows[0].columns.flatMap((column) => column.widget ? [column.widget] : []);
      for (const after of DASHBOARD_PRESETS) {
        const result = changeDashboardRowPreset(source, "r", after.id);
        assert.deepEqual(source, snapshot);
        assert.deepEqual(normalizeDashboardLayout(result.layout), result.layout);
        assert.equal(result.layout.rows[0].columns.length, after.fractions.length);
        const kept = result.layout.rows[0].columns.flatMap((column) => column.widget ? [column.widget] : []);
        assert.equal(kept.length, Math.min(originalWidgets.length, after.fractions.length));
        assert.deepEqual([...kept, ...result.removedWidgets].sort(), [...originalWidgets].sort());
        assert.deepEqual(result.layout.rows[0].columns.slice(0, Math.min(before.fractions.length, after.fractions.length)).map((column) => column.id), source.rows[0].columns.slice(0, after.fractions.length).map((column) => column.id));
        assert.notEqual(result.layout.rows[0].columns[0], source.rows[0].columns[0]);
      }
    }
  }
});

test("editing helpers handle a missing row safely and clone without sharing mutable objects", () => {
  const source = createDefaultDashboardLayout();
  const result = changeDashboardRowPreset(source, "missing", "quarters");
  assert.deepEqual(result.layout, source);
  assert.deepEqual(result.removedWidgets, []);
  const copied = cloneDashboardLayout(source);
  copied.rows[0].columns[0].widget = null;
  copied.rows.reverse();
  assert.equal(source.rows[0].columns[0].widget, "planner");
});
