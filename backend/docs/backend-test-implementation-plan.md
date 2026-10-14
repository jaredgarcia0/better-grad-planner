# Backend API Test Implementation Plan

## Purpose

This document identifies the backend API tests that are still missing and provides a phased plan for implementing them. Steps 1 and 2 are complete: Vitest has explicit configuration, shared test infrastructure exists, and the current smoke suite passes. Resource route, authentication route, and database-integration coverage remain to be implemented.

## Completed work

- Added `backend/vitest.config.ts` with a single-worker thread pool and isolated test-file execution.
- Added the `test:coverage` script to `backend/package.json`.
- Extracted Prisma mocks into `tests/support/prisma-mocks.ts` and switched setup to full mock resets.
- Added deterministic IDs, starter fixtures, and reusable response assertions under `tests/support/`.
- Verified `npm run typecheck` passes.
- Verified the current suite passes: seven unit test files are present.

The shared helpers are intentionally small. Add remaining model fixtures and assertions as resource suites are implemented.

## Current state

The existing tests cover health, unknown routes, course validation, course listing, course creation, missing courses, empty updates, and Prisma `P2002` handling. The app now exposes authentication routes in addition to the nine catalog resource areas and nested relationship endpoints. Prisma is mocked, so the current suite does not verify real database constraints, migrations, or seed behavior.

The current route-test scope is still narrow: `app.test.ts` exercises health, unknown-route handling, representative course CRUD/validation/error behavior, and invalid filters across catalog list routes. There are no dedicated authentication or catalog resource route suites yet, and no nested relationship route has a successful test.

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
│   │   ├── auth-middleware.test.ts
│   │   ├── auth-utils.test.ts
│   │   └── routes/
│   │       ├── auth.test.ts
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
- [x] Confirm failure behavior for an intentionally failing test and an unhandled setup error.
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
- [x] Add fixtures for every current Prisma model, including users, sessions, verification codes, and reset codes.
- [x] Add not-found and Prisma error assertions.
- [x] Add an explicit helper for asserting that a model method was not called.

Keep the app-level Prisma mock for route/controller tests. Do not mock Prisma in the database integration suite.

### Remaining pre-phase work: coverage thresholds

Defer thresholds until the shared, auth, and catalog route suites provide meaningful coverage. Then:

1. Install the Vitest V8 coverage provider if it is not already available: `npm install -D @vitest/coverage-v8`.
2. Run `npm run test:coverage` and review the generated report.
3. Add a `coverage` block to `vitest.config.ts` with explicit `provider: "v8"`, reporters, and initial thresholds.
4. Start with realistic thresholds based on the measured baseline, then raise them as coverage improves.
5. Run coverage in CI so threshold regressions fail the build.

## Phase 1: shared behavior and middleware tests

### Request validation

Completed coverage in `tests/unit/parse.test.ts`, `tests/unit/middleware.test.ts`, and the existing `tests/unit/app.test.ts`:

- [x] Invalid UUID path parameters.
- [x] Pagination defaults, minimum/maximum values, and invalid page/page-size values.
- [x] Boolean parsing and invalid booleans.
- [x] Required, optional, nullable, and trimmed strings; optional blank-string semantics remain unverified.
- [x] Date parsing and invalid dates at the shared parser level.
- [x] Empty update bodies and a valid parsed request.
- [x] Validation failures prevent the controller from running in middleware tests; the existing route tests also prove Prisma is not called for representative invalid requests.

Phase 1 validation coverage is substantially covered, but boundary hardening remains. The route tests cover invalid UUID query filters across the catalog resources, every catalog enum and invalid enum input, request defaults, valid partial updates with exact Prisma payloads, Zod's unknown-property stripping behavior, and HTTP-level invalid dates with no Prisma access.

Remaining validation edge coverage:

- [ ] Test empty/whitespace integer inputs, negative and decimal pagination values, `null`, non-finite values, and array-valued query parameters.
- [ ] Test blank optional strings and decide whether they should become `undefined`, `null`, or be rejected; document and enforce the chosen behavior.
- [ ] Test empty strings, timezone offsets, non-ISO parseable dates, and impossible dates at the HTTP boundary.
- [ ] Test unknown-property stripping independently for body, query, and parameter schemas.
- [ ] Test malformed JSON request bodies and confirm their error response shape.

### Shared response and error behavior

Completed coverage in `tests/unit/common-controller.test.ts`, `tests/unit/middleware.test.ts`, and `tests/unit/app.test.ts`:

- [x] Paginated responses with records and with no records.
- [x] `totalPages`, `skip`, and `take` calculations.
- [x] Successful get, create, patch, and `204` delete responses.
- [x] Prisma `P2002`, `P2025`, and `P2003` mappings.
- [x] `HttpError` responses and unexpected errors returning `500`.

Phase 1 shared behavior coverage is substantially covered, but controller and middleware failure paths still need hardening. Route-level tests verify representative async failures, `P2025`, `P2003`, generic `500` errors, and the exact empty `204` response.

Remaining shared behavior edge coverage:

- [ ] Test `listResource` when `findMany` rejects and when `count` rejects, including `Promise.all` error propagation.
- [ ] Test exact response envelopes and status codes for every shared CRUD operation, not only that a response method was called.
- [ ] Test direct controller behavior for malformed/missing pagination and non-object update bodies.
- [ ] Test `P2025` and `P2003` delete/update behavior at more than one representative route.
- [ ] Test malformed JSON and unusual/missing Prisma error codes through the HTTP error handler.

### Authentication utilities and middleware

Completed coverage in `tests/unit/auth-utils.test.ts` and `tests/unit/auth-middleware.test.ts`:

- [x] Email normalization and BYU email detection.
- [x] Token hashing, session-token generation, verification-code format, and timing-safe code comparison.
- [x] Cookie extraction, session cookie construction, and cookie clearing in the non-production environment.
- [x] Missing, valid, revoked, expired, and unknown sessions; hashed-token lookup.

Phase 1 authentication utility and middleware coverage is substantially covered. It includes production `Secure` cookies, duplicate-cookie behavior, and Prisma lookup failures forwarded to `next()`, but the following security and boundary cases remain:

- [ ] Assert that a valid session assigns `req.userId` to the authenticated user.
- [ ] Test empty cookies, malformed percent-encoding, quoted values, and cookie values containing additional `=` characters.
- [ ] Define and test malformed-cookie behavior; `decodeURIComponent` failures must not become an accidental unhandled `500` if the intended result is `401`.
- [ ] Assert the complete set/clear cookie attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age`, and production-only `Secure`.
- [ ] Test authentication lookup failures through the full HTTP app and verify the resulting `500` response.
- [ ] Test `isByuiEmail` with an empty local part, subdomains, trailing dots, uppercase input, and surrounding whitespace.
- [ ] Test `codesMatch` with empty, malformed, odd-length, and incorrectly sized hashes.
- [ ] Test repeated token/code generation for uniqueness or explicitly document why randomness is not asserted.

Phase 1 completion should not be marked complete until the remaining edge cases above are either implemented or explicitly waived with documented behavior.

## Phase 2: resource endpoint tests

Create one route test file per resource under `tests/unit/routes/`. Each file should cover list, create, get, patch, delete, validation, Prisma arguments, ordering, and resource-specific errors.

### Authentication

Authentication should use `tests/unit/routes/auth.test.ts`, with supporting unit tests for `requireAuth` and the auth utility functions. Mock Prisma, email delivery, password hashing, and token generation where appropriate so route tests remain deterministic and never send real email or persist real credentials.

#### Schema and route validation

Test every auth request schema for:

- Valid and invalid email addresses.
- Trimming and lowercasing email addresses.
- Password minimum and maximum lengths.
- Eight-digit verification and reset codes.
- Missing fields, blank values, malformed codes, and unexpected values.
- Validation failures not reaching Prisma, email delivery, or password hashing.

#### Registration: `POST /api/auth/register`

Test:

- Successful registration for a valid `@byui.edu` address, including password hashing, user creation, verification-code replacement/creation, email delivery, and `201` response.
- Rejection of non-`@byui.edu` addresses.
- Normalization of email before the lookup and write.
- Existing unverified user being updated and receiving a replacement code with `200`.
- Existing verified user receiving `409`.
- Verification-code expiry data being created with the configured duration.
- Rate-limit rejection after the configured number of attempts.
- Email-service failure reaching the error handler.

#### Email verification: `POST /api/auth/verify-email`

Test:

- Invalid or non-BYU email behavior.
- Missing user, missing code, expired code, used code, and maximum-attempt rejection.
- Attempt count incrementing before code comparison.
- Correct code updating `emailVerifiedAt`, marking the code used, creating a session, setting the HTTP-only session cookie, and returning only public user fields.
- Incorrect code not verifying the user or creating a session.

#### Login: `POST /api/auth/login`

Test:

- Successful login with normalized email and valid password.
- Invalid email and invalid password returning the same `401` response.
- Unverified users receiving `403` and no session.
- Verified users receiving a session record and correctly configured cookie.
- Dummy-password verification being used for unknown users so response behavior does not reveal account existence.
- Login rate limiting.

#### Forgot password: `POST /api/auth/forgot-password`

Test:

- Always returning `202` with the non-disclosing message.
- Non-BYU and unknown email addresses not creating reset codes or sending email.
- Verified BYU users receiving a reset-code replacement and email.
- Unverified users not receiving a reset code.
- Forgot-password rate limiting.

#### Password reset: `POST /api/auth/reset-password`

Test:

- Missing user, missing/expired/used code, maximum attempts, and incorrect code.
- Attempt count increment before code comparison.
- Correct code hashing the new password and atomically marking the code used and deleting all existing sessions.
- Successful response message and no password hash/code/session data leaking in the response.
- Reset rate limiting and transaction failure handling.

#### Current user and logout

For `GET /api/auth/me`, test:

- Missing cookie returning `401` before Prisma access.
- Unknown, revoked, and expired sessions returning `401`.
- Valid session attaching `req.userId` and returning public user fields only.
- Missing user for an otherwise valid session returning `401`.

For `POST /api/auth/logout`, test:

- Cookie session token being hashed and deleted from Prisma.
- Missing cookie still clearing the cookie and returning `204`.
- Session deletion failure reaching the error handler.
- Cookie attributes including `HttpOnly`, `SameSite=Lax`, `Path=/`, and the correct `Max-Age`; `Secure` should be asserted when `NODE_ENV=production`.

#### Auth middleware and utility tests

In `tests/unit/auth-middleware.test.ts`, test cookie extraction, session lookup, expiry/revocation checks, `req.userId` assignment, and `next()` behavior. In `tests/unit/auth-utils.test.ts`, test email normalization, BYU email detection, token hashing, code format, timing-safe code matching, session-token generation, cookie construction, and cookie clearing.

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

Track every registered endpoint across the authentication routes and nine catalog resources. Authentication needs endpoint-specific success, validation, authorization, cookie, rate-limit, and error coverage; each catalog resource needs list/create/get/patch/delete coverage, and each nested route needs parent filtering and pagination coverage.

Contract assertions should verify:

- `{ data }` and paginated response envelopes.
- Status codes `200`, `201`, `204`, `400`, `404`, `409`, and `500`.
- Correct Prisma model methods and arguments.
- No database access after validation failure.

## Phase 4: database integration tests

Use a disposable PostgreSQL database or isolated schema with a separate Vitest configuration. The setup should set a test-only `DATABASE_URL`, apply migrations, clear tables or use transactions, insert explicit fixtures, and disconnect Prisma after the suite. Never use the development database.

Verify required/optional columns, UUID relationships, unique and foreign-key errors, cascade and set-null behavior, nested persisted records, date and enum round-tripping, pagination counts, seed compatibility, and the full auth flow using real users, sessions, verification codes, and reset codes. Confirm password hashes are never returned and session records are invalidated after logout and password reset.

## Phase 5: test data and fixtures

Expand the support fixtures to include one user, verified and unverified user variants, sessions, verification codes, reset codes, one university, one department, two courses, one program, parent/child requirements, requirement-course links, prerequisites, terms, and offerings. Use deterministic IDs and partial overrides; avoid randomness except when testing uniqueness or ID generation.

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
4. [ ] Complete shared middleware, parsing, response, error, and auth utility boundary tests listed in the Phase 1 gap checklists.
5. [ ] Add `tests/unit/routes/auth.test.ts` and complete the remaining auth middleware edge coverage.
6. [ ] Complete course CRUD and relationship coverage.
7. [ ] Add the remaining eight catalog resource route files.
8. [ ] Complete the route matrix and coverage reporting.
9. [ ] Add disposable PostgreSQL integration tests for catalog and authentication flows.
10. [ ] Add seed/migration verification and enforce test/coverage commands in CI.

## Definition of done

- `npm run typecheck` passes.
- `npm test` runs reliably without worker or setup errors.
- Every registered API route has at least one test.
- Every authentication endpoint has success, validation, security, cookie, rate-limit, and error coverage.
- Every resource has happy-path CRUD coverage.
- All filters and defaults have tests.
- Nested endpoints have parent-filter and pagination tests.
- Validation failures prove Prisma is not called.
- `P2002`, `P2025`, `P2003`, and unexpected errors are covered.
- Integration tests verify migrations, relationships, constraints, and representative seed behavior.
- Coverage is reported and enforced in CI.
