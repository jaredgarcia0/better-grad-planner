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
creation accepts `courseId`, optional `termId`, `sequence`, and optional
`notes`. Completed courses accept `courseId`, optional `termId`, `grade`,
`creditsEarned`, and `completedOn`; transfer courses replace `termId` with an
optional `transferSource`.

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

