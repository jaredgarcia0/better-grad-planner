import { expect } from "vitest";

type ResponseLike = {
  status: number;
  body: Record<string, any>;
  text?: string;
};

export function expectListResponse(
  response: ResponseLike,
  data: unknown[],
  pagination: { page: number; pageSize: number; total: number; totalPages: number },
) {
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data, pagination });
}

export function expectValidationFailure(response: ResponseLike, field: string) {
  expect(response.status).toBe(400);
  expect(response.body.error).toContain(`${field} validation failed`);
  expect(response.body.details).toBeDefined();
}

export function expectNoContent(response: ResponseLike) {
  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  expect(response.text ?? "").toBe("");
}
