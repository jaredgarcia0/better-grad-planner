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

export type University = { id: string; name: string; shortName?: string | null };
export type Program = { id: string; name: string; degreeType?: string | null };
export type RequirementGroup = { id: string; name: string; requirementType: string; minCredits?: number | null; maxCredits?: number | null };
export type RequirementCourseLink = { id: string; courseId: string; creditsOverride?: number | null };
export type ApiList<T> = { data: T[]; pagination: Pagination };

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
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
    throw new Error(`API request failed (${response.status}): ${message || response.statusText}`);
  }

  return response.json() as Promise<T>;
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
  return apiRequest<ApiList<RequirementGroup>>(`/api/programs/${programId}/requirements?pageSize=100`);
}

export function listRequirementCourses(requirementId: string) {
  return apiRequest<ApiList<RequirementCourseLink>>(`/api/requirements/${requirementId}/courses?pageSize=100`);
}

export function getCourse(courseId: string) {
  return apiRequest<{ data: Course }>(`/api/courses/${courseId}`);
}
