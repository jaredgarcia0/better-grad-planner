export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Course = {
  id: string;
  code: string;
  title: string;
  credits: number;
  level?: string | null;
  active?: boolean;
  department?: { name?: string; code?: string } | null;
};

export type University = {
  id: string;
  name: string;
  shortName?: string | null;
};
export type Program = {
  id: string;
  name: string;
  code?: string;
  degreeType?: string | null;
  catalogYear?: number | null;
  totalCredits?: number | null;
};
export type AcademicTerm = {
  id: string;
  universityId: string;
  name: string;
  code: string;
  startsOn: string;
  endsOn: string;
};
export type RequirementGroup = {
  id: string;
  name: string;
  requirementType: string;
  minCredits?: number | null;
  maxCredits?: number | null;
};
export type RequirementCourseLink = {
  id: string;
  courseId: string;
  creditsOverride?: number | null;
};
export type ApiList<T> = { data: T[]; pagination: Pagination };
export type User = {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
};

export type DegreePlanStatus = "DRAFT" | "ARCHIVED" | "DECLARED";

export type DegreePlan = {
  id: string;
  userId: string;
  programId: string;
  name: string;
  notes: string | null;
  status: DegreePlanStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateDegreePlanPayload = {
  programId: string;
  name: string;
  notes?: string | null;
  status?: DegreePlanStatus;
  isDefault?: boolean;
};

export type UpdateDegreePlanPayload = Partial<
  Pick<DegreePlan, "programId" | "name" | "notes" | "status" | "isDefault">
>;

export type PlannedCourseEntry = {
  id: string;
  planId: string;
  courseId: string;
  termId: string | null;
  sequence: number;
  notes: string | null;
};

export type CreatePlannedCoursePayload = {
  courseId: string;
  termId?: string | null;
  sequence?: number;
  notes?: string | null;
};

export type UpdatePlannedCoursePayload = Partial<
  Pick<PlannedCourseEntry, "courseId" | "termId" | "sequence" | "notes">
>;

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    const detail = await response.text();
    let message = detail;
    try {
      const parsed = JSON.parse(detail) as { error?: string; message?: string };
      message = parsed.error ?? parsed.message ?? detail;
    } catch {
      // Keep the raw response when the server did not return JSON.
    }
    throw new Error(
      `API request failed (${response.status}): ${message || response.statusText}`,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function register(email: string, password: string) {
  return apiRequest<{ message: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function verifyEmail(email: string, code: string) {
  return apiRequest<{ data: User }>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function login(email: string, password: string) {
  return apiRequest<{ data: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function requestPasswordReset(email: string) {
  return apiRequest<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(email: string, code: string, password: string) {
  return apiRequest<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, code, password }),
  });
}

export function getCurrentUser() {
  return apiRequest<{ data: User }>("/api/auth/me");
}

export function logout() {
  return apiRequest<void>("/api/auth/logout", { method: "POST" });
}

export function listCourses(query = "") {
  const params = new URLSearchParams({ pageSize: "8" });
  if (query.trim()) params.set("q", query.trim());
  return apiRequest<ApiList<Course>>(`/api/courses?${params}`);
}

export function listUniversities() {
  return apiRequest<ApiList<University>>("/api/universities?pageSize=5");
}

export function listPrograms(query = "", page = 1) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "100",
  });
  if (query.trim()) params.set("q", query.trim());
  return apiRequest<ApiList<Program>>(`/api/programs?${params}`);
}

export async function listAllPrograms() {
  const firstPage = await listPrograms();
  if (firstPage.pagination.totalPages <= 1) return firstPage.data;

  const remainingPages = await Promise.all(
    Array.from(
      { length: firstPage.pagination.totalPages - 1 },
      (_, index) => listPrograms("", index + 2),
    ),
  );
  return [
    ...firstPage.data,
    ...remainingPages.flatMap((page) => page.data),
  ];
}

export function getProgram(programId: string) {
  return apiRequest<{ data: Program }>(`/api/programs/${programId}`);
}

export function listTerms() {
  return apiRequest<ApiList<AcademicTerm>>("/api/terms?pageSize=100");
}

export function listProgramRequirements(programId: string) {
  return apiRequest<ApiList<RequirementGroup>>(
    `/api/programs/${programId}/requirements?pageSize=100`,
  );
}

export function listRequirementCourses(requirementId: string) {
  return apiRequest<ApiList<RequirementCourseLink>>(
    `/api/requirements/${requirementId}/courses?pageSize=100`,
  );
}

export function getCourse(courseId: string) {
  return apiRequest<{ data: Course }>(`/api/courses/${courseId}`);
}

export function listPlans(status?: DegreePlanStatus) {
  const params = new URLSearchParams({ pageSize: "100" });
  if (status) params.set("status", status);
  return apiRequest<ApiList<DegreePlan>>(`/api/plans?${params}`);
}

export function getPlan(planId: string) {
  return apiRequest<{ data: DegreePlan }>(`/api/plans/${planId}`);
}

export function createPlan(payload: CreateDegreePlanPayload) {
  return apiRequest<{ data: DegreePlan }>("/api/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePlan(
  planId: string,
  payload: UpdateDegreePlanPayload,
) {
  return apiRequest<{ data: DegreePlan }>(`/api/plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePlan(planId: string) {
  return apiRequest<void>(`/api/plans/${planId}`, { method: "DELETE" });
}

export function listPlannedCourses(planId: string, termId?: string) {
  const params = new URLSearchParams({ pageSize: "100" });
  if (termId) params.set("termId", termId);
  return apiRequest<ApiList<PlannedCourseEntry>>(
    `/api/plans/${planId}/courses?${params}`,
  );
}

export function createPlannedCourse(
  planId: string,
  payload: CreatePlannedCoursePayload,
) {
  return apiRequest<{ data: PlannedCourseEntry }>(
    `/api/plans/${planId}/courses`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updatePlannedCourse(
  planId: string,
  courseEntryId: string,
  payload: UpdatePlannedCoursePayload,
) {
  return apiRequest<{ data: PlannedCourseEntry }>(
    `/api/plans/${planId}/courses/${courseEntryId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function deletePlannedCourse(
  planId: string,
  courseEntryId: string,
) {
  return apiRequest<void>(
    `/api/plans/${planId}/courses/${courseEntryId}`,
    { method: "DELETE" },
  );
}
