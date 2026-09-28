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

Authentication, authorization, users, and student graduation plans are intentionally not included yet because those models do not exist in the current Prisma schema.
