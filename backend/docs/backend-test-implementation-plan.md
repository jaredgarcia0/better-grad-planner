# Backend API Test Implementation Plan

## Purpose

This document identifies the backend API tests that are still missing and provides a phased plan for implementing them. Steps 1 and 2 are complete: Vitest has explicit configuration, shared test infrastructure exists, and the current smoke suite passes. Resource, middleware, and database-integration coverage remain to be implemented.

## Completed work

- Added `backend/vitest.config.ts` with a single-worker thread pool and isolated test-file execution.
- Added the `test:coverage` script to `backend/package.json`.
- Extracted Prisma mocks into `tests/support/prisma-mocks.ts` and switched setup to full mock resets.
- Added deterministic IDs, starter fixtures, and reusable response assertions under `tests/support/`.
- Verified `npm run typecheck` passes.
- Verified the current suite passes: 1 test file and 10 tests.

The shared helpers are intentionally small. Add remaining model fixtures and assertions as resource suites are implemented.

## Current state

The existing tests cover health, unknown routes, course validation, course listing, course creation, missing courses, empty updates, and Prisma `P2002` handling. The app exposes nine resource areas plus nested relationship endpoints. Prisma is mocked, so the current suite does not verify real database constraints, migrations, or seed behavior.

## Recommended test-file structure

Keep all tests outside production code. Use `src/` only for application code and place mocked/unit/route tests and integration tests under `backend/tests/`.

```text
backend/
├── src/                         # production code only
├── tests/
│   ├── unit/
│   │   ├── app.test.ts
│   │   ├── middleware.test.ts
│   │   ├── parse.test.ts
│   │   ├── common-controller.test.ts
│   │   └── routes/
│   │       ├── universities.test.ts
│   │       ├── departments.test.ts
│   │       ├── programs.test.ts
│   │       ├── requirements.test.ts
│   │       ├── courses.test.ts
│   │       ├── requirement-courses.test.ts
│   │       ├── prerequisites.test.ts
│   │       ├── terms.test.ts
│   │       └── offerings.test.ts
│   ├── support/
│   │   ├── fixtures.ts
│   │   ├── prisma-mocks.ts
│   │   ├── request-helpers.ts
│   │   └── test-ids.ts
│   └── integration/
│       ├── setup.ts
│       ├── universities.integration.test.ts
│       ├── catalog.integration.test.ts
│       └── relationships.integration.test.ts
└── vitest.config.ts
```

Unit and route tests should use mocked Prisma and run quickly. Integration tests should use PostgreSQL and a separate Vitest configuration. Resource route files should own their nested relationship tests; for example, `tests/unit/routes/courses.test.ts` should cover course prerequisites and offerings.

## Test architecture to establish first

### 1. Make Vitest execution reliable - complete

- [x] Add explicit `vitest.config.ts`.
- [x] Configure a thread-based test pool with one worker.
- [x] Add `npm run test:coverage`.
- [x] Run `npm test` successfully with the existing suite.
- [ ] Confirm failure behavior for an intentionally failing test and an unhandled setup error.
- [ ] Add coverage thresholds after meaningful route coverage exists.

Suggested future scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:integration": "vitest run --config vitest.integration.config.ts"
}
```

### 2. Improve mock isolation - complete for the current suite

`resetPrismaMocks()` calls `vi.resetAllMocks()` before each test, preventing resolved and rejected implementations from leaking between tests. The helpers now live under `tests/support/`, separate from production code.

- [x] Valid UUID constants in `tests/support/test-ids.ts`.
- [x] Reusable mocked Prisma models in `tests/support/prisma-mocks.ts`.
- [x] Starter course, university, and pagination fixtures in `tests/support/fixtures.ts`.
- [x] List, validation-failure, and no-content assertions in `tests/support/request-helpers.ts`.
- [ ] Add fixtures for every remaining Prisma model.
- [ ] Add not-found and Prisma error assertions.
- [ ] Add explicit helpers for asserting that a model method was not called.

Keep the app-level Prisma mock for route/controller tests. Do not mock Prisma in the database integration suite.

## Phase 1: shared behavior and middleware tests

### Request validation

Add tests for:

- Invalid UUID path parameters and UUID query filters.
- Default, minimum, and maximum pagination values.
- Invalid page and page-size values.
- Boolean parsing and invalid booleans.
- All degree, requirement, prerequisite, and course-level enums.
- Required, optional, nullable, blank, and trimmed strings.
- Date parsing and invalid dates.
- Defaults for `active`, `operator`, `sequence`, prerequisite type, group number, and alternative flags.
- Empty update bodies and valid partial updates.
- Unknown request properties.

Every validation test should assert the HTTP response and that Prisma was not called.

### Shared response and error behavior

Add tests for:

- Paginated responses with records and with no records.
- `totalPages`, `skip`, and `take` calculations.
- Successful get, patch, and `204` delete responses.
- Prisma `P2002`, `P2025`, and `P2003` mappings.
- Unexpected errors returning `500`.
- Async controller errors reaching the error handler.

## Phase 2: resource endpoint tests

Create one route test file per resource under `tests/unit/routes/`. Each file should cover list, create, get, patch, delete, validation, Prisma arguments, ordering, and resource-specific errors.

### Universities

- List with and without trimmed `q`.
- Create, get, patch, delete, and invalid input.
- Nested departments, programs, and courses with search, pagination, and parent filtering.

### Departments

- List with `q`, `universityId`, and combined filters.
- Create, get, patch, delete, invalid UUIDs, missing fields, and error mappings.

### Degree programs

- List with `q`, `universityId`, `degreeType`, and numeric `catalogYear`.
- Create defaults and nullable fields.
- Get, patch, delete, invalid enum/integer/UUID input.
- Nested requirements with search, pagination, sequence ordering, and parent filtering.

### Requirement groups

- List with program, parent, type, and operator filters.
- Create defaults, nullable `parentId`, and course/credit limits.
- Get, patch, delete, invalid input, and nested courses.

### Courses

Expand the current tests with university, department, and level filters; default listing; successful get/patch/delete; `P2025`, `P2003`, and generic errors; and nested prerequisites and offerings.

### Requirement-course links

- List with requirement and course filters.
- Sequence ordering and pagination.
- Create defaults, optional grade/credit fields, invalid input, and complete CRUD/error coverage.

### Prerequisites

- Course, prerequisite-course, and type filters.
- Group-number ordering and creation defaults.
- Optional minimum grade, invalid enum/UUID/integer/boolean input, CRUD, and error mappings.

### Academic terms

- Search, university filtering, combined filters, and `startsOn` ordering.
- ISO date coercion and invalid-date handling.
- CRUD and nested offerings with course ordering.

### Course offerings

- Course and term filters with term ordering.
- Required IDs, optional section/instructor/meeting/capacity fields.
- Invalid input, CRUD, empty updates, and Prisma error mappings.

## Phase 3: route matrix and contract tests

Track every registered endpoint across the nine resources. Each resource needs list/create/get/patch/delete coverage, and each nested route needs parent filtering and pagination coverage.

Contract assertions should verify:

- `{ data }` and paginated response envelopes.
- Status codes `200`, `201`, `204`, `400`, `404`, `409`, and `500`.
- Correct Prisma model methods and arguments.
- No database access after validation failure.

## Phase 4: database integration tests

Use a disposable PostgreSQL database or isolated schema with a separate Vitest configuration. The setup should set a test-only `DATABASE_URL`, apply migrations, clear tables or use transactions, insert explicit fixtures, and disconnect Prisma after the suite. Never use the development database.

Verify required/optional columns, UUID relationships, unique and foreign-key errors, cascade and set-null behavior, nested persisted records, date and enum round-tripping, pagination counts, and seed compatibility.

## Phase 5: test data and fixtures

Expand the support fixtures to include one university, one department, two courses, one program, parent/child requirements, requirement-course links, prerequisites, terms, and offerings. Use deterministic IDs and partial overrides; avoid randomness except when testing uniqueness or ID generation.

## Coverage and quality targets

After the first three phases:

- Every registered route has executed at least once.
- Every request schema has valid and invalid cases.
- Every Prisma error mapping is tested.
- Every resource has list/create/get/patch/delete coverage.
- Every nested route has parent-filter coverage.
- Validation tests prove Prisma is not called.
- Tests are order-independent.

Once stable, enforce statement, branch, function, and line coverage thresholds. Branch coverage is especially important for filter construction and error handling.

## Recommended implementation sequence

1. [x] Add Vitest configuration and resolve the worker/setup issue.
2. [x] Strengthen mock reset behavior and add initial shared test helpers.
3. [x] Move `app.test.ts` and shared helpers into the separated `tests/` tree and update TypeScript/Vitest paths.
4. [ ] Add shared middleware, parsing, response, and error tests.
5. [ ] Complete course CRUD and relationship coverage.
6. [ ] Add the remaining eight resource route files.
7. [ ] Complete the route matrix and coverage reporting.
8. [ ] Add disposable PostgreSQL integration tests.
9. [ ] Add seed/migration verification.
10. [ ] Enforce test and coverage commands in CI.

## Definition of done

- `npm run typecheck` passes.
- `npm test` runs reliably without worker or setup errors.
- Every registered API route has at least one test.
- Every resource has happy-path CRUD coverage.
- All filters and defaults have tests.
- Nested endpoints have parent-filter and pagination tests.
- Validation failures prove Prisma is not called.
- `P2002`, `P2025`, `P2003`, and unexpected errors are covered.
- Integration tests verify migrations, relationships, constraints, and representative seed behavior.
- Coverage is reported and enforced in CI.
