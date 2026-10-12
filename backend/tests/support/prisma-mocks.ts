import { vi } from "vitest";

type MockModel = {
  findMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const createModel = (): MockModel => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

export const prismaMocks = {
  course: createModel(),
  coursePrerequisite: createModel(),
  courseOffering: createModel(),
  university: createModel(),
  department: createModel(),
  degreeProgram: createModel(),
  requirementGroup: createModel(),
  requirementCourse: createModel(),
  academicTerm: createModel(),
};

export function resetPrismaMocks() {
  vi.resetAllMocks();
}
