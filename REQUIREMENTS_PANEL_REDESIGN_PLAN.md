# Requirements Panel Redesign Plan

## Goal

Redesign the requirements panel so that it:

- Has a separate tab for the major and every minor or certificate included in the current degree plan.
- Shows the selected program's requirements in collapsible sections.
- Allows each course to be added directly from the panel.
- Allows a course to be selected to view additional information.
- Preserves the existing term-placement workflow and planned-course state.

## Current implementation

The current panel is implemented in `frontend/src/components/RequirementsPanel.tsx`.

Today it:

- Receives a flat `programs` array from `App.tsx`.
- Assumes the first non-minor program is the major and the first minor program is the minor.
- Loads requirement groups and then makes additional requests for requirement courses and course details.
- Renders only the first four courses in each requirement group.
- Displays major and minor content as stacked sections rather than tabs.
- Uses a fixed `major/general/electives` layout that can be reordered and persisted as `requirementLayout`.
- Does not expose course-add or course-selection actions.

The active plan is assembled in `frontend/src/App.tsx`. The current frontend plan model supports one `major` and one optional `minor`; certificates are not currently represented as programs in a plan.

The backend data model already supports multiple program types, including `CERTIFICATE`, and requirement groups support nesting through `parentId` and the `RequirementGroupTree` relation in `backend/prisma/schema.prisma`.

## Recommended architecture

### Represent included programs as a collection

Replace the hard-coded major/minor assumption with a program collection:

```ts
type PlanProgram = {
  program: Program;
  role: "MAJOR" | "MINOR" | "CERTIFICATE";
};
```

The plan should expose its included programs in display order. Existing plans should be migrated in memory by converting:

- `major` to a `MAJOR` entry.
- `minor`, when present, to a `MINOR` entry.

If certificates are intended to be saved as part of a backend-backed plan, introduce a join model such as `DegreePlanProgram` with `planId`, `programId`, `role`, and `sequence`. The current backend `DegreePlan` model has only one `programId`, while the frontend currently persists plans in local storage.

### Represent requirements as a tree

Use a recursive type for requirement groups:

```ts
type RequirementNode = RequirementGroup & {
  courses: RequirementCourse[];
  children: RequirementNode[];
};
```

The backend already stores `parentId`, but the current frontend treats all groups as a flat list. The requirements API should return nested groups, ideally with their course links and course summaries in one response to avoid the current request-per-group and request-per-course pattern.

### Requirements panel state

The redesigned panel should manage:

```ts
activeProgramId: string;
expandedGroupIds: Set<string>;
selectedCourse: Course | null;
```

It should also receive:

```ts
plannedCourseIds: Set<string>;
onAddCourse: (course: Course) => void;
```

The major should be selected by default. Expansion state should be retained when switching tabs whenever possible.

## Required implementation steps

### 1. Update the plan program model

Files:

- `frontend/src/components/PlanLibrary.tsx`
- `frontend/src/App.tsx`

Tasks:

1. Add a `PlanProgram` type and a `programs` collection to `GraduationPlan`.
2. Convert existing major/minor plans to the new collection format when loading from local storage.
3. Update plan creation and editing to preserve the new collection.
4. Extend plan setup so users can add and remove certificates in addition to minors.
5. Keep the major required and ensure duplicate programs cannot be added.
6. Update plan overview text and sidebar summaries to list all included programs.
7. Derive `activePrograms` from the plan collection instead of constructing `[major, minor]` manually.

If backend persistence is added or enabled later, add the corresponding database migration, API validation, and controller support for the plan-program join records.

### 2. Update program and requirement API types

File:

- `frontend/src/api/client.ts`

Tasks:

1. Add complete types for requirement groups, including `parentId`, `description`, `operator`, course constraints, and child groups.
2. Add a requirement-course type that includes the embedded course summary returned by the API.
3. Add a `RequirementNode` type for the frontend tree.
4. Update `Program` to include any fields needed by the panel, such as `code`, `catalogYear`, and `totalCredits`.
5. Add or update a request function that loads a complete program requirement tree.
6. Reuse the existing course prerequisite API for course details.

### 3. Improve the requirements endpoint

Files:

- `backend/src/controllers/programs.controller.ts`
- `backend/src/controllers/requirements.controller.ts`
- `backend/src/routes/requirements.routes.ts`
- `backend/prisma/schema.prisma`

Tasks:

1. Return nested requirement groups using `parentId` and `sequence` ordering.
2. Include requirement courses and their course summaries in the program requirements response.
3. Preserve requirement-specific data such as minimum grade and credit overrides.
4. Ensure the response supports `ALL` and `ANY` requirement operators.
5. Confirm that certificate and minor programs use the same response shape as majors.
6. Add backend tests for root groups, nested groups, course ordering, and program filtering.

The preferred result is one request per program rather than the current sequence of one request per group followed by one course request per requirement link.

### 4. Replace stacked sections with program tabs

File:

- `frontend/src/components/RequirementsPanel.tsx`

Tasks:

1. Remove the current `major/general/electives` section rendering and section-reorder controls.
2. Render a tab for each included program.
3. Show the program role and name in each tab.
4. Use accessible tab semantics: `role="tablist"`, `role="tab"`, `aria-selected`, and `aria-controls`.
5. Select the major by default.
6. Fall back to the major if the active program is removed.
7. Keep the tab row usable on narrow screens with horizontal scrolling.
8. Show appropriate loading, empty, and error states for the selected program.

Suggested labels include:

- `Major · Computer Science`
- `Minor · Mathematics`
- `Certificate · Web Development`

### 5. Implement collapsible requirement groups

Files:

- `frontend/src/components/RequirementsPanel.tsx`
- `frontend/src/styles.css`

Tasks:

1. Replace the current `RequirementGroupView` with a recursive component.
2. Make every requirement group independently expandable and collapsible.
3. Display the requirement name, type, rule operator, and constraints in the header.
4. Display a completion summary such as planned courses versus required courses when the necessary data is available.
5. Render nested child groups beneath their parent.
6. Show all courses instead of truncating after four.
7. Expand top-level groups by default.
8. Preserve or restore groups containing planned courses when switching tabs.
9. Add keyboard and screen-reader support for each collapse control.

### 6. Add courses from the panel

Files:

- `frontend/src/components/RequirementsPanel.tsx`
- `frontend/src/App.tsx`

Tasks:

1. Add an `Add` button to each unplanned course row.
2. Show `Planned` or `Added` for courses already in `plannedCourseIds`.
3. Pass a new `onAddCourse` callback from `App.tsx` to the requirements panel.
4. Reuse `requestCoursePlacement(course)` so panel additions open the existing term-selection dialog.
5. Prevent duplicate additions.
6. Ensure the panel updates immediately after a course is added or removed.
7. Keep the action available for courses in majors, minors, and certificates.

The existing placement flow is in `App.tsx`:

- `requestCoursePlacement()` selects the initial term and opens the placement dialog.
- `placeCourse()` adds the course to the active plan with the selected term.
- `plannedCourseIds` identifies courses already in the plan.

### 7. Add course selection and details

Files:

- `frontend/src/components/RequirementsPanel.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/styles.css`

Tasks:

1. Make each course row selectable or provide an explicit info button.
2. Track the selected course in panel state.
3. Display a detail drawer, modal, or inline detail area.
4. Include course code, title, credits, description, level, and department when available.
5. Load and display prerequisites and corequisites using `listCoursePrerequisites()`.
6. Show whether the course is already planned and its assigned term when available.
7. Include an add action in the detail view when the course is not planned.
8. Provide an accessible close action and keyboard behavior.

### 8. Replace or redefine requirement-layout persistence

Files:

- `frontend/src/App.tsx`
- `frontend/src/components/PlanLibrary.tsx`
- `frontend/src/api/client.ts`
- `backend/src/schemas/student-records.schemas.ts`
- `backend/prisma/migrations/`

The current `requirementLayout` value stores the old fixed section IDs: `major`, `general`, and `electives`. Those IDs do not describe the new tabbed design.

Choose one of these approaches:

1. Remove the old setting if tab selection and expansion do not need to persist.
2. Replace it with a panel-state object:

   ```ts
   type RequirementsPanelState = {
     activeProgramId?: string;
     expandedGroupIdsByProgram: Record<string, string[]>;
   };
   ```

3. Keep backward compatibility by reading the old value but no longer writing it.

If panel state is persisted, update the backend schema validation and database JSON field accordingly. Also migrate old local-storage plans without causing the application to crash.

### 9. Update styling and responsive behavior

File:

- `frontend/src/styles.css`

Tasks:

1. Remove styles specific to section reordering.
2. Add active, inactive, hover, and focus states for program tabs.
3. Add clear expand/collapse affordances for requirement groups.
4. Add course action-button styles that fit the existing visual language.
5. Style the selected-course detail view.
6. Make long program names and course titles truncate or wrap safely.
7. Make the tab row horizontally scrollable on small screens.
8. Verify that the panel remains usable beside `CourseSearch` in the existing `.content-grid`.

## Suggested component structure

```text
RequirementsPanel
├── ProgramTabs
├── ProgramRequirements
│   └── RequirementGroupView
│       ├── RequirementGroupHeader
│       ├── CourseRequirementRow
│       └── RequirementGroupView (nested children)
└── CourseDetails
```

Possible callback surface:

```ts
type RequirementsPanelProps = {
  programs: PlanProgram[];
  plannedCourseIds: Set<string>;
  onAddCourse: (course: Course) => void;
};
```

## Verification checklist

### Program tabs

- Major-only plan displays one tab.
- Major plus minor displays two tabs.
- Major plus certificate displays two tabs.
- Major plus minor plus certificate displays three tabs.
- Removing the active non-major program returns the panel to the major tab.
- Long names remain usable on narrow screens.

### Requirement groups

- Root groups appear in sequence order.
- Nested groups appear under the correct parent.
- Groups can be expanded and collapsed independently.
- All courses are reachable; none are hidden after the fourth item.
- `ALL` and `ANY` metadata is shown correctly.
- Loading, empty, and error states are understandable.

### Course actions

- Every unplanned course has an add action.
- Adding from the panel opens the existing term-selection dialog.
- The course becomes marked as planned after placement.
- Planned courses cannot be added twice.
- Course selection opens details without accidentally adding the course.
- Details include description and prerequisite/corequisite information when available.

### Compatibility and persistence

- Existing local-storage plans still load.
- Existing major/minor plans convert to the new program collection.
- Old `requirementLayout` data does not break the panel.
- If persistence is implemented, panel state is restored per plan.

## Recommended implementation order

1. Add and migrate the plan-program collection.
2. Normalize the requirements API response into a tree.
3. Replace the requirements panel layout with tabs.
4. Add recursive collapsible requirement groups.
5. Add course actions using the existing placement flow.
6. Add course selection and details.
7. Decide and implement panel-state persistence.
8. Finish responsive styling and accessibility.
9. Add frontend and backend tests, then perform a manual end-to-end verification.

## Key files

- `frontend/src/components/RequirementsPanel.tsx`
- `frontend/src/components/PlanLibrary.tsx`
- `frontend/src/components/PlanBoard.tsx`
- `frontend/src/App.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/styles.css`
- `backend/src/controllers/programs.controller.ts`
- `backend/src/controllers/requirements.controller.ts`
- `backend/src/schemas/student-records.schemas.ts`
- `backend/prisma/schema.prisma`

