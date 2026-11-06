# Better Grad Planner API

Start the API from this directory with:

```bash
npm run dev
```

The server listens on `http://localhost:3000` by default. Every list endpoint accepts:

- `page` (default `1`)
- `pageSize` (default `25`, maximum `100`)
- resource-specific filters documented below

List responses have this shape:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0
  }
}
```

## Health

```text
GET /health
```

## Authentication

Authentication uses verified `@byui.edu` email addresses, Argon2id password hashes, and an HTTP-only session cookie.

```text
POST /api/auth/register
POST /api/auth/verify-email
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
POST /api/auth/logout
```

Registration and password reset codes expire after 10 minutes. In development, when SMTP is not configured, codes are printed to the backend log. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM` before using the flow in production. Set `CLIENT_ORIGIN` to the exact frontend origin when the frontend calls the API directly.

## Resources

Every resource has `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, and `DELETE /:id` unless noted otherwise.

| Resource | Base path | Useful filters |
| --- | --- | --- |
| Universities | `/api/universities` | `q` |
| Departments | `/api/departments` | `q`, `universityId` |
| Degree programs | `/api/programs` | `q`, `universityId`, `degreeType`, `catalogYear` |
| Requirement groups | `/api/requirements` | `programId`, `parentId`, `requirementType`, `operator` |
| Courses | `/api/courses` | `q`, `universityId`, `departmentId`, `level`, `active` |
| Requirement-course links | `/api/requirement-courses` | `requirementId`, `courseId` |
| Prerequisites | `/api/prerequisites` | `courseId`, `prerequisiteCourseId`, `type` |
| Academic terms | `/api/terms` | `q`, `universityId` |
| Course offerings | `/api/offerings` | `courseId`, `termId` |
| Degree plans | `/api/plans` | `status` |
| Completed courses | `/api/completed-courses` | — |
| Transfer courses | `/api/transfer-courses` | — |

## Student records

Degree plans, planned courses, completed courses, and transfer courses require
an authenticated session. These resources are always scoped to the current
user; a request for another user's record returns `404`.

```text
GET    /api/plans
POST   /api/plans
GET    /api/plans/:id
PATCH  /api/plans/:id
PUT    /api/plans/:id/workspace
DELETE /api/plans/:id

GET    /api/plans/:planId/courses
POST   /api/plans/:planId/courses
GET    /api/plans/:planId/courses/:courseEntryId
PATCH  /api/plans/:planId/courses/:courseEntryId
DELETE /api/plans/:planId/courses/:courseEntryId

GET    /api/completed-courses
POST   /api/completed-courses
GET    /api/completed-courses/:id
PATCH  /api/completed-courses/:id
DELETE /api/completed-courses/:id

GET    /api/transfer-courses
POST   /api/transfer-courses
GET    /api/transfer-courses/:id
PATCH  /api/transfer-courses/:id
DELETE /api/transfer-courses/:id
```

Plan creation accepts `programId`, `name`, optional `notes`, optional `status`
(`DRAFT`, `ARCHIVED`, or `DECLARED`), and optional `isDefault`. Planned-course
creation accepts `courseId`, optional UUID `termId`, optional nullable semester
slug `termKey` (e.g. `fall-2026` or `""` for unassigned), `sequence`, and optional
`notes`. Completed courses accept `courseId`, optional `termId`, `grade`,
`creditsEarned`, and `completedOn`; transfer courses replace `termId` with an
optional `transferSource`.

### Dashboard layouts

Plan POST/PATCH also accept optional `requirementLayout` (the existing array of
up to three `"major"`, `"general"`, `"electives"` entries) and optional
`dashboardLayout`. Omitting `dashboardLayout` preserves the existing value on
PATCH. Explicit `null` resets to the default dashboard and is stored as JSON null
(`Prisma.JsonNull`), rather than SQL NULL. Legacy plans may have SQL NULL; both
serialize to JSON `null`. An empty `rows` array is an intentional empty dashboard.

```json
{
  "version": 1,
  "rows": [
    {
      "id": "main-row",
      "layout": "halves",
      "columns": [
        { "id": "planner-column", "widget": "planner" },
        { "id": "empty-column", "widget": null }
      ]
    }
  ]
}
```

The layout object, each row, and each column reject unknown properties. Version
must be the number `1`. There may be 0–20 rows; row and column IDs are nonblank
strings of 1–80 characters and must be globally unique across all rows and
columns. IDs are preserved verbatim. Columns must have an explicit `widget`,
either null or one of `planner`, `requirements`, `course-search`, `notes`,
`progress`, `prerequisites`. Each nonnull widget may appear at most once in the
entire dashboard. Null may be used in multiple columns.

| Row layout | Required columns |
| --- | --- |
| `full` | 1 |
| `halves`, `third-two-thirds`, `two-thirds-third`, `three-quarters-quarter`, `quarter-three-quarters` | 2 |
| `thirds`, `quarter-half-quarter`, `quarter-quarter-half`, `half-quarter-quarter` | 3 |
| `quarters` | 4 |

### Atomic workspace save

`PUT /api/plans/:id/workspace` saves a full workspace snapshot under a
client-selected UUID. It creates a missing plan or updates the authenticated
user's plan. An existing ID belonging to another account always returns `404`;
the endpoint cannot take ownership of it. A session cookie is required.

```json
{
  "name": "Computer Science plan",
  "programId": "44444444-4444-4444-8444-444444444444",
  "programs": [
    { "programId": "44444444-4444-4444-8444-444444444444", "role": "MAJOR" }
  ],
  "startTerm": "fall-2026",
  "endTerm": "spring-2030",
  "notes": "",
  "dashboardLayout": null,
  "requirementLayout": ["major", "general", "electives"],
  "courses": [
    { "courseId": "33333333-3333-4333-8333-333333333333", "termKey": "fall-2026" }
  ]
}
```

All shown properties except `requirementLayout` are required. Unknown snapshot,
program reference, and course entry properties are rejected. `name` is trimmed,
nonblank, and limited to 80 characters for this endpoint; legacy POST/PATCH name
behavior remains unchanged. `notes` is a string, including `""` to clear notes.
The API's existing 1 MB JSON request limit applies.

`programs` contains 1–500 distinct UUID references. Exactly one entry must have
role `MAJOR`, matching `programId`. Every program must exist in the catalog.
`MAJOR` accepts `ASSOCIATE`, `BACHELOR`, `MASTER`, or `DOCTORATE` degree types;
`MINOR` and `CERTIFICATE` must match their catalog degree type. Additional program
details can be fetched with `GET /api/programs/:id`.

`startTerm`, `endTerm`, and each course's `termKey` accept either `""` or exactly
`(fall|winter|spring)-YYYY`. Empty strings are preserved. When both bounds are
set, start must be on or before end, ordered by calendar year then winter,
spring, fall. Courses are not required to lie within those bounds. `courses`
contains at most 500 unique course UUIDs, with array order stored as zero-based
`sequence`. An empty array removes all planned courses. Catalog course foreign
keys are enforced by the database.

The plan, program references, dashboard and course reconciliation commit in one
serializable transaction. Removed courses are deleted; retained courses keep
their entry IDs and notes; new courses are inserted. Retained legacy `termId`
links remain when their assignment is unchanged. For a null legacy `termKey`, a
term name such as `Fall 2026` maps to `fall-2026` (case insensitive); an unknown
name maps to `""`. Changing the effective assignment clears `termId`, including
when explicitly unassigning a previously assigned course. Saving the same
snapshot again preserves course IDs and metadata and creates no duplicates.
Plan `updatedAt` may advance on repeated saves. Status and default-plan settings
are preserved on update and use existing defaults on create. An omitted
`requirementLayout` preserves its previous value.

Success is `200` for both create and update, with `{ "data": plan }`. A bad
snapshot, missing catalog reference, or incompatible program role returns `400`.
Authentication failures return `401`. Existing `(userId, name)` uniqueness is
preserved: duplicate plan names return `409`, allowing the client to retry with
a renamed plan. Any course write failure rolls back the entire snapshot.
Serialization conflicts are retried up to twice.

### Restoring a workspace

Both `GET /api/plans` and `GET /api/plans/:id`, plus workspace PUT responses,
include all plan scalar fields, including `programs`, `startTerm`, `endTerm`,
`dashboardLayout`, and `requirementLayout`. New fields are nullable for legacy
plans; no catalog migration or automatic backfill is performed. Responses also
include the primary `program` summary (all scalar fields such as `id`, `name`,
`code`, `degreeType`, `catalogYear`, `universityId`, `totalCredits`) and ordered
`courses`. Each course entry includes `id`, `planId`, `courseId`, `termKey`,
`termId`, `sequence`, `notes`, a `course` summary (all scalar fields including
`id`, `code`, `title`, `credits`, `description`), and `term`. For a legacy UUID
term link, `term` includes its scalar fields and `startDate` (an ISO date alias
for `startsOn`); otherwise `term` is null. A legacy null `termKey` remains null
in responses so the client can map `term.name` or render it as unassigned.

Plan listing retains its pagination envelope and status filter. Clients must
load all plan pages. Nested courses are complete and are not separately
paginated in these responses. The existing `/courses` list endpoint remains
paginated and also includes `termKey`.

### Schema deployment and verification

`prisma/migrations/20261106000000_plan_workspace/migration.sql` only adds nullable
columns to `DegreePlan` and `PlannedCourse`; it does not rewrite existing data.
Apply it through your normal deployment process before running the updated API.
Client generation does not apply migrations or connect to a database:

```bash
npm run prisma:generate
npm run typecheck
npm test -- tests/unit/plan-workspace-schemas.test.ts tests/unit/plan-workspace-routes.test.ts
```

Use a Node runtime supported by the installed Prisma/Vitest versions (verified
with Node 24). These tests use mocked catalog/storage and a transaction double
to verify rollback boundaries and repeat saves; they do not require or migrate
a database. Route tests use Supertest local sockets, which must be permitted by
the execution environment. They do not replace PostgreSQL integration testing.

## Relationship endpoints

These are read-only convenience routes for the catalog relationships:

```text
GET /api/universities/:id/departments
GET /api/universities/:id/programs
GET /api/universities/:id/courses
GET /api/programs/:id/requirements
GET /api/requirements/:id/courses
GET /api/courses/:id/prerequisites
GET /api/courses/:id/offerings
GET /api/terms/:id/offerings
```

## Example

```bash
curl "http://localhost:3000/api/courses?q=computer&pageSize=10"
```

Create requests use JSON. For example:

```json
{
  "universityId": "00000000-0000-0000-0000-000000000000",
  "code": "CS 101",
  "title": "Introduction to Computer Science",
  "credits": 3,
  "level": "INTRODUCTORY"
}
```

