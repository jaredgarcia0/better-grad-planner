import { testIds } from "./test-ids.js";

const passwordHash = "argon2id$v=19$m=65536,t=3,p=4$test$fixture";
const codeHash = "fixture-code-hash";

export const userFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.user,
  email: "student@byui.edu",
  passwordHash,
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

export const sessionFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.session,
  userId: testIds.user,
  tokenHash: "fixture-session-token-hash",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  revokedAt: null,
  ...overrides,
});

export const emailVerificationCodeFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.verificationCode,
  userId: testIds.user,
  codeHash,
  attempts: 0,
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  usedAt: null,
  ...overrides,
});

export const passwordResetCodeFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.resetCode,
  userId: testIds.user,
  codeHash,
  attempts: 0,
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  usedAt: null,
  ...overrides,
});

export const courseFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.course,
  universityId: testIds.university,
  departmentId: testIds.department,
  code: "CS 101",
  title: "Introduction to Computer Science",
  credits: 3,
  active: true,
  ...overrides,
});

export const universityFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.university,
  name: "Test University",
  shortName: "TU",
  websiteUrl: "https://example.test",
  ...overrides,
});

export const departmentFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.department,
  universityId: testIds.university,
  code: "CS",
  name: "Computer Science",
  ...overrides,
});

export const programFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.program,
  universityId: testIds.university,
  code: "BS-CS",
  name: "Computer Science",
  degreeType: "BACHELOR",
  catalogYear: 2026,
  ...overrides,
});

export const requirementFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.requirement,
  programId: testIds.program,
  parentId: null,
  name: "Major Requirements",
  requirementType: "REQUIRED",
  operator: "ALL",
  sequence: 0,
  ...overrides,
});

export const requirementCourseFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.requirementCourse,
  requirementId: testIds.requirement,
  courseId: testIds.course,
  sequence: 0,
  ...overrides,
});

export const prerequisiteFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.prerequisite,
  courseId: testIds.secondCourse,
  prerequisiteCourseId: testIds.course,
  type: "PREREQUISITE",
  groupNumber: 0,
  isAlternative: false,
  ...overrides,
});

export const termFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.term,
  universityId: testIds.university,
  name: "Fall 2026",
  code: "2026-FALL",
  startsOn: new Date("2026-09-01T00:00:00.000Z"),
  endsOn: new Date("2026-12-31T00:00:00.000Z"),
  ...overrides,
});

export const offeringFixture = (overrides: Record<string, unknown> = {}) => ({
  id: testIds.offering,
  courseId: testIds.course,
  termId: testIds.term,
  sectionCode: "001",
  instructor: "Test Instructor",
  capacity: 30,
  seatsOpen: 10,
  ...overrides,
});

export const paginationFixture = (overrides: Record<string, number> = {}) => ({
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
  ...overrides,
});
