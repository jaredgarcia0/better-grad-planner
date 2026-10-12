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

export function expectNotFound(response: ResponseLike) {
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ error: "The requested record was not found." });
}

export function expectPrismaError(
  response: ResponseLike,
  status: number,
  message: string,
) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({ error: message });
}

export function expectNotCalled(mock: { mock: unknown }) {
  expect(mock).not.toHaveBeenCalled();
}

export function expectNoContent(response: ResponseLike) {
  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  expect(response.text ?? "").toBe("");
}
