# Better Grad-Planner

## Team Members

Kyle Nordick
Jared Garcia
Byron Mckitrick
Dawson Robinson

## Software Description

A remake of BYU-Idaho's grad planner, a system to allow students to plan out the courses that they will take and when they will take them in order to graduate with specific degrees.

## Architecture

Built as a web app, with a React frontend, Express backend, and PostreSQL database.

## Customizable plan dashboards

Open a graduation plan and choose **Edit dashboard** to add rows, choose from
11 column layouts, and select Planner, Requirements, Course search, Notes,
Credit summary, or Prerequisites widgets. Rows can be moved or deleted. Save
commits the draft; Cancel discards it. Each widget can appear once per plan.
Use **Edit plan details** to rename the plan and its dashboard.

Signed-in accounts load and save complete plans through the API. Guest plans
remain in the current browser. After signing in, **Import browser plans** copies
older account-specific browser plans to the server and retains the original
browser backup. Name collisions receive a numbered suffix. Guest plans are
kept separate from account plans.

Before running this version against a database, apply the additive workspace
migration and regenerate the Prisma client:

```sh
nvm use
cd backend
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
```

These commands use the backend's configured `DATABASE_URL`. The migration adds
nullable dashboard, program, semester-range, and course-semester fields;
existing plans receive the default dashboard when no saved layout exists.

Verification, after installing frontend and backend dependencies:

```sh
cd backend
npm run typecheck
npm test
npm run test:frontend
cd ../frontend
npm run build
```

Backend tests use mocked database access and temporary local HTTP ports. The
frontend model and persistence tests use Node's test runner through the backend's
installed `tsx`; they require no running database or browser.

## Software Features

- [ ] Full Database of BYUI Programs and Courses
- [ ] Accounts per-student
- [ ] Class schedule planner
- [ ] Multiple degree plans per account

## Team Communication

Discord

## Team Responsibility

| Responsibility                   | Team Member(s) |
| -------------------------------- | -------------- |
| Conducting Meetings              | Byron          |
| Maintaining Team Assignment List | Kyle           |
| Work on backend authentication      | Jared          |
| Maintaining Documentation        | Kyle           |
| Create & Display Presentations   | Dawson         |
| Submit Team Assignments          | Kyle           |

## Reflections
