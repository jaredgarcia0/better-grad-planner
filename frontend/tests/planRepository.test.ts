import assert from "node:assert/strict";
import { beforeEach, test, type TestContext } from "node:test";
import type { Course, DegreePlan, Program } from "../src/api/client";
import type { GraduationPlan } from "../src/components/PlanLibrary";
import { createDefaultDashboardLayout, type DashboardLayout } from "../src/dashboardLayout";
import {
  importedLocalPlanIds,
  loadLocalPlans,
  loadRemotePlans,
  markLocalPlanImported,
  saveLocalPlans,
  saveRemotePlan,
  savedPlansKey,
} from "../src/planRepository";

// Tests run serially because the repository uses process-wide browser globals.
function stubGlobal(key: "fetch" | "localStorage", value: unknown) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}

beforeEach((t) => {
  // Restore the pre-test descriptors once, even when a test replaces a guard stub.
  for (const key of ["fetch", "localStorage"] as const) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  stubGlobal("fetch", async () => {
    throw new Error("Unexpected fetch: tests must stub every request");
  });
  stubGlobal("localStorage", {
    getItem() { throw new Error("Unexpected localStorage read"); },
    setItem() { throw new Error("Unexpected localStorage write"); },
  });
});

function memoryStorage() {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() { return entries.size; },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: (key) => { entries.delete(key); },
    clear: () => { entries.clear(); },
  };
  stubGlobal("localStorage", storage);
  return storage;
}

type Request = { url: URL; options: RequestInit };

function mockFetch(t: TestContext, respond: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  stubGlobal("fetch", t.mock.fn(async (input: string | URL, options: RequestInit = {}) => {
    const request = { url: new URL(String(input), "http://test.invalid"), options };
    requests.push(request);
    assert.equal(options.credentials, "include", "remote persistence must include the auth cookie");
    assert.equal(new Headers(options.headers).get("Content-Type"), "application/json");
    return respond(request);
  }));
  return requests;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const major: Program = { id: "major-cs", name: "Computer Science", degreeType: "BACHELOR" };
const minor: Program = { id: "minor-math", name: "Mathematics", degreeType: "MINOR" };
const certificate: Program = { id: "cert-data", name: "Data Science", degreeType: "CERTIFICATE" };
const otherMajor: Program = { id: "major-art", name: "Art", degreeType: "BACHELOR" };
const course: Course = { id: "cs-101", code: "CS 101", title: "Introduction", credits: 3 };
const customLayout: DashboardLayout = {
  version: 1,
  rows: [{
    id: "my-row", layout: "halves",
    columns: [{ id: "my-notes", widget: "notes" }, { id: "my-empty-slot", widget: null }],
  }],
};

function guestPlan(overrides: Partial<GraduationPlan> = {}): GraduationPlan {
  return {
    id: "plan-guest", name: "My graduation plan",
    programs: [{ program: major, role: "MAJOR" }], major, minor: null,
    startTerm: "fall-2026", endTerm: "spring-2030",
    courses: [{ ...course, termId: "winter-2027" }],
    notes: "Ask my advisor about CS 101.\nKeep Fridays free.",
    requirementLayout: ["electives", "major", "general"],
    ...overrides,
  };
}

function remotePlan(overrides: Partial<DegreePlan> = {}): DegreePlan {
  return {
    id: "plan-remote", userId: "student", name: "Remote plan",
    programId: major.id, program: major, programs: null,
    startTerm: null, endTerm: null, notes: null,
    requirementLayout: null, dashboardLayout: null, courses: [],
    status: "DRAFT", isDefault: false,
    createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

function page(data: DegreePlan[], pageNumber = 1, totalPages = 1) {
  return json({ data, pagination: { page: pageNumber, pageSize: 100, total: totalPages, totalPages } });
}

test("guest legacy major/minor plans normalize without losing notes, requirements, or courses", () => {
  const storage = memoryStorage();
  const { programs: _programs, ...legacy } = guestPlan({ minor });
  storage.setItem(savedPlansKey("guest"), JSON.stringify([legacy]));
  const original = storage.getItem(savedPlansKey("guest"));

  assert.deepEqual(loadLocalPlans("guest"), [{
    ...legacy,
    programs: [{ program: major, role: "MAJOR" }, { program: minor, role: "MINOR" }],
    dashboardLayout: createDefaultDashboardLayout(),
  }]);
  assert.equal(storage.getItem(savedPlansKey("guest")), original, "reading must not rewrite the saved plan");
});

test("guest saves round-trip all programs and custom dashboard layout in separate workspaces", () => {
  const storage = memoryStorage();
  const plan = guestPlan({
    programs: [
      { program: major, role: "MAJOR" }, { program: minor, role: "MINOR" },
      { program: certificate, role: "CERTIFICATE" },
    ],
    minor, dashboardLayout: customLayout,
  });
  saveLocalPlans("guest", [plan]);
  saveLocalPlans("another-guest", []);

  assert.equal(savedPlansKey("guest"), "better-grad-planner:guest:plans");
  assert.deepEqual(JSON.parse(storage.getItem(savedPlansKey("guest"))!), [plan]);
  assert.deepEqual(loadLocalPlans("guest"), [plan]);
  assert.deepEqual(loadLocalPlans("another-guest"), []);
});

test("guest loading ignores invalid entries while retaining a valid major-only legacy plan", () => {
  const storage = memoryStorage();
  const { programs: _programs, ...legacy } = guestPlan();
  storage.setItem(savedPlansKey("guest"), JSON.stringify([
    null, 42, "invalid", {}, { ...legacy, id: null }, { ...legacy, courses: null },
    { ...legacy, major: null }, legacy,
  ]));

  assert.deepEqual(loadLocalPlans("guest"), [{
    ...legacy, programs: [{ program: major, role: "MAJOR" }],
    dashboardLayout: createDefaultDashboardLayout(),
  }]);
});

test("missing, corrupt, or non-array guest storage loads as an empty library", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadLocalPlans("guest"), []);
  for (const raw of ["{broken JSON", "null", "{}", "42"]) {
    storage.setItem(savedPlansKey("guest"), raw);
    assert.deepEqual(loadLocalPlans("guest"), [], raw);
  }
});

test("unavailable guest storage loads safely but write failures reach the caller", () => {
  const readError = new Error("Storage access denied");
  const writeError = new Error("Quota exceeded");
  stubGlobal("localStorage", {
    getItem() { throw readError; },
    setItem() { throw writeError; },
  });

  assert.deepEqual(loadLocalPlans("guest"), []);
  assert.throws(() => saveLocalPlans("guest", [guestPlan()]), (error) => error === writeError);
});

test("import receipts are scoped, cumulative, and retain the raw backup even without a cloud copy", async (t) => {
  const storage = memoryStorage();
  const plan = guestPlan();
  const rawBackup = `\n${JSON.stringify([plan], null, 2)}\n`;
  storage.setItem(savedPlansKey("guest"), rawBackup);
  storage.setItem(savedPlansKey("another-guest"), rawBackup);
  assert.deepEqual(importedLocalPlanIds("guest"), new Set());

  markLocalPlanImported("guest", plan.id);
  markLocalPlanImported("guest", "previously-imported");
  markLocalPlanImported("guest", plan.id);
  assert.deepEqual(importedLocalPlanIds("guest"), new Set([plan.id, "previously-imported"]));
  assert.deepEqual(JSON.parse(storage.getItem(`${savedPlansKey("guest")}:imported`)!), [
    plan.id, "previously-imported",
  ]);
  assert.deepEqual(importedLocalPlanIds("another-guest"), new Set());
  markLocalPlanImported("another-guest", "another-plan");
  assert.deepEqual(importedLocalPlanIds("another-guest"), new Set(["another-plan"]));

  mockFetch(t, () => page([]));
  assert.deepEqual(await loadRemotePlans(), [], "the migrated cloud copy is no longer present");
  assert.ok(importedLocalPlanIds("guest").has(plan.id), "a missing cloud copy must not erase its receipt");
  assert.equal(importedLocalPlanIds("another-guest").has(plan.id), false);
  for (const workspace of ["guest", "another-guest"]) {
    assert.equal(storage.getItem(savedPlansKey(workspace)), rawBackup, "backup bytes must stay unchanged");
    assert.equal(loadLocalPlans(workspace)[0].id, plan.id, "the original local plan remains recoverable");
  }
});

test("malformed import receipts load safely and can be replaced with a valid receipt", () => {
  const storage = memoryStorage();
  const receiptKey = `${savedPlansKey("guest")}:imported`;
  for (const raw of ["{broken JSON", "null", "{}", "42", '"not an array"']) {
    storage.setItem(receiptKey, raw);
    assert.deepEqual(importedLocalPlanIds("guest"), new Set(), raw);
    assert.equal(storage.getItem(receiptKey), raw, "reading malformed receipts must not rewrite storage");
    assert.doesNotThrow(() => markLocalPlanImported("guest", "new-plan"));
    assert.deepEqual(importedLocalPlanIds("guest"), new Set(["new-plan"]));
  }

  storage.setItem(receiptKey, JSON.stringify(["existing", null, 42, {}, false, "existing", "other"]));
  assert.deepEqual(importedLocalPlanIds("guest"), new Set(["existing", "other"]));
  markLocalPlanImported("guest", "new-plan");
  assert.deepEqual(JSON.parse(storage.getItem(receiptKey)!), ["existing", "other", "new-plan"]);
});

test("receipt storage failures do not throw after a successful server save", async (t) => {
  const plan = guestPlan();
  const requests = mockFetch(t, () => json({ data: remotePlan({ id: plan.id }) }));
  await saveRemotePlan(plan);
  const setItem = t.mock.fn(() => { throw new Error("Quota exceeded"); });
  stubGlobal("localStorage", { getItem: () => "[]", setItem });

  assert.doesNotThrow(() => markLocalPlanImported("guest", plan.id));
  assert.equal(setItem.mock.callCount(), 1, "the receipt write was attempted");

  const getItem = t.mock.fn(() => { throw new Error("Storage access denied"); });
  stubGlobal("localStorage", { getItem, setItem });
  assert.deepEqual(importedLocalPlanIds("guest"), new Set());
  assert.doesNotThrow(() => markLocalPlanImported("guest", plan.id));
  assert.equal(getItem.mock.callCount(), 2);
  assert.equal(setItem.mock.callCount(), 2);
  assert.equal(requests.length, 1, "receipt failures must not trigger another server save");
});

test("authenticated loading reads every page and hydrates shared program references once", async (t) => {
  const programs = [
    { programId: minor.id, role: "MINOR" as const },
    { programId: major.id, role: "MAJOR" as const },
    { programId: certificate.id, role: "CERTIFICATE" as const },
    { programId: otherMajor.id, role: "MAJOR" as const },
  ];
  const first = remotePlan({
    id: "first", programs, startTerm: "fall-2026", endTerm: "spring-2030",
    notes: "Remote notes\nwith a second line", requirementLayout: ["general", "electives", "major"],
    courses: [{ course, termKey: "winter-2027", term: { name: "Fall 2020" } }],
  });
  const second = remotePlan({ id: "second", programs, dashboardLayout: customLayout });
  // A major embedded on a later page should also satisfy earlier references.
  const third = remotePlan({ id: "third", programId: otherMajor.id, program: otherMajor });
  const requests = mockFetch(t, ({ url, options }) => {
    assert.equal(options.method ?? "GET", "GET");
    if (url.pathname === "/api/plans") {
      assert.equal(url.searchParams.get("pageSize"), "100");
      switch (url.searchParams.get("page")) {
        case "1": return page([first], 1, 3);
        case "2": return page([second], 2, 3);
        case "3": return page([third], 3, 3);
      }
    }
    if (url.pathname === `/api/programs/${minor.id}`) return json({ data: minor });
    if (url.pathname === `/api/programs/${certificate.id}`) return json({ data: certificate });
    assert.fail(`Unexpected request ${url}`);
  });

  const plans = await loadRemotePlans();
  assert.deepEqual(plans.map(({ id }) => id), ["first", "second", "third"]);
  assert.deepEqual(plans[0], {
    id: first.id, name: first.name,
    programs: [
      { program: minor, role: "MINOR" }, { program: major, role: "MAJOR" },
      { program: certificate, role: "CERTIFICATE" }, { program: otherMajor, role: "MAJOR" },
    ],
    major, minor, startTerm: first.startTerm, endTerm: first.endTerm,
    notes: first.notes, requirementLayout: first.requirementLayout,
    dashboardLayout: createDefaultDashboardLayout(), courses: [{ ...course, termId: "winter-2027" }],
  });
  assert.deepEqual(plans[1].programs, plans[0].programs);
  assert.deepEqual(plans[1].dashboardLayout, customLayout);
  assert.deepEqual(plans[2].programs, [{ program: otherMajor, role: "MAJOR" }]);
  assert.equal(plans[2].minor, null);
  assert.equal(plans[2].startTerm, "");
  assert.equal(plans[2].endTerm, "");
  assert.equal(plans[2].notes, "");
  assert.equal(plans[2].requirementLayout, undefined);
  assert.deepEqual(requests.map(({ url }) => `${url.pathname}${url.search}`).sort(), [
    "/api/plans?pageSize=100&page=1", "/api/plans?pageSize=100&page=2",
    "/api/plans?pageSize=100&page=3", `/api/programs/${minor.id}`, `/api/programs/${certificate.id}`,
  ].sort());
});

test("an empty authenticated library needs no extra page or program requests", async (t) => {
  const requests = mockFetch(t, () => page([], 1, 0));
  assert.deepEqual(await loadRemotePlans(), []);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, "/api/plans");
});

test("legacy remote terms recover named semesters and keep null or unknown terms unassigned", async (t) => {
  const entries: DegreePlan["courses"] = [
    { course, termKey: "spring-2028", term: null },
    { course: { ...course, id: "fall" }, termKey: null, term: { name: "Fall Semester 2026" } },
    { course: { ...course, id: "winter" }, termKey: "", term: { name: "WINTER 2027" } },
    { course: { ...course, id: "spring" }, termKey: null, term: { name: "Spring 2027" } },
    { course: { ...course, id: "null-term" }, termKey: null, term: null },
    { course: { ...course, id: "missing-term" }, termKey: null },
    { course: { ...course, id: "unknown-term" }, termKey: null, term: { name: "Undecided" } },
  ];
  mockFetch(t, () => page([remotePlan({ programs: [], courses: entries })]));

  const [plan] = await loadRemotePlans();
  assert.deepEqual(plan.courses, entries.map(({ course }, index) => ({
    ...course, termId: ["spring-2028", "fall-2026", "winter-2027", "spring-2027", "", "", ""][index],
  })));
  assert.deepEqual(plan.programs, [{ program: major, role: "MAJOR" }]);
});

for (const failingStage of ["first page", "later page", "program hydration"] as const) {
  test(`authenticated loading propagates ${failingStage} failures`, async (t) => {
    const requests = mockFetch(t, ({ url }) => {
      if (failingStage === "first page" || url.searchParams.get("page") === "2"
        || url.pathname === `/api/programs/${minor.id}`) {
        return json({ error: `${failingStage} unavailable` }, 503);
      }
      if (failingStage === "later page") return page([remotePlan()], 1, 2);
      return page([remotePlan({ programs: [
        { programId: major.id, role: "MAJOR" }, { programId: minor.id, role: "MINOR" },
      ] })]);
    });

    await assert.rejects(loadRemotePlans(), {
      message: `API request failed (503): ${failingStage} unavailable`,
    });
    assert.equal(requests.length, failingStage === "first page" ? 1 : 2);
  });
}

test("remote save PUTs the complete workspace, including every program and unassigned course", async (t) => {
  const plan = guestPlan({
    programs: [
      { program: major, role: "MAJOR" }, { program: otherMajor, role: "MAJOR" },
      { program: minor, role: "MINOR" }, { program: certificate, role: "CERTIFICATE" },
    ],
    minor, dashboardLayout: customLayout,
    courses: [{ ...course, termId: "winter-2027" }, { ...course, id: "math-101", termId: "" }],
  });
  const original = JSON.stringify(plan);
  const requests = mockFetch(t, () => json({ data: remotePlan() }));

  await saveRemotePlan(plan);
  assert.equal(requests.length, 1);
  const [{ url, options }] = requests;
  assert.equal(url.pathname, `/api/plans/${plan.id}/workspace`);
  assert.equal(url.search, "");
  assert.equal(options.method, "PUT");
  assert.deepEqual(JSON.parse(String(options.body)), {
    name: plan.name, programId: major.id,
    programs: [
      { programId: major.id, role: "MAJOR" }, { programId: otherMajor.id, role: "MAJOR" },
      { programId: minor.id, role: "MINOR" }, { programId: certificate.id, role: "CERTIFICATE" },
    ],
    startTerm: plan.startTerm, endTerm: plan.endTerm, notes: plan.notes,
    requirementLayout: plan.requirementLayout, dashboardLayout: customLayout,
    courses: [{ courseId: course.id, termKey: "winter-2027" }, { courseId: "math-101", termKey: "" }],
  });
  assert.equal(JSON.stringify(plan), original, "serializing must not mutate the open plan");
});

test("remote save supports a legacy guest plan and defaults absent notes and layout", async (t) => {
  const { programs: _programs, ...legacy } = guestPlan({ minor, notes: undefined });
  const requests = mockFetch(t, () => new Response(null, { status: 204 }));

  // Old stored records predate the required programs property.
  await saveRemotePlan(legacy as GraduationPlan);
  const body = JSON.parse(String(requests[0].options.body));
  assert.deepEqual(body.programs, [
    { programId: major.id, role: "MAJOR" }, { programId: minor.id, role: "MINOR" },
  ]);
  assert.equal(body.notes, "");
  assert.deepEqual(body.dashboardLayout, createDefaultDashboardLayout());
});

test("remote save propagates server rejection", async (t) => {
  const requests = mockFetch(t, () => json({ error: "Workspace could not be saved" }, 500));
  await assert.rejects(saveRemotePlan(guestPlan()), {
    message: "API request failed (500): Workspace could not be saved",
  });
  assert.equal(requests.length, 1, "a failed save must not silently retry");
});

test("remote save propagates a rejected fetch unchanged", async (t) => {
  const offline = new TypeError("Failed to fetch");
  mockFetch(t, () => { throw offline; });
  await assert.rejects(saveRemotePlan(guestPlan()), (error) => error === offline);
});
