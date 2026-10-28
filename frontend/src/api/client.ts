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
export type Program = { id: string; name: string; degreeType?: string | null };
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
export type CoursePrerequisite = {
  id: string;
  courseId: string;
  prerequisiteCourseId: string;
  type: "PREREQUISITE" | "COREQUISITE";
  groupNumber: number;
  isAlternative: boolean;
  minimumGrade?: string | null;
};
export type ApiList<T> = { data: T[]; pagination: Pagination };
export type User = {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
};

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

export function listPrograms(query = "") {
  const params = new URLSearchParams({ pageSize: "5" });
  if (query.trim()) params.set("q", query.trim());
  return apiRequest<ApiList<Program>>(`/api/programs?${params}`);
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

export function listCoursePrerequisites(courseId: string) {
  return apiRequest<ApiList<CoursePrerequisite>>(
    `/api/courses/${courseId}/prerequisites?pageSize=100`,
  );
}
