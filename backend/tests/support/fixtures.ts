import { testIds } from "./test-ids.js";

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

export const paginationFixture = (overrides: Record<string, number> = {}) => ({
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
  ...overrides,
});
