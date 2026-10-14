import { describe, expect, it, vi } from "vitest";
import {
  createResource,
  deleteResource,
  getResource,
  listResource,
  updateResource,
} from "../../src/controllers/common.controller.js";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as any;
}

const req = (overrides: Record<string, unknown> = {}) =>
  ({ params: { id: "item-1" }, query: { page: "2", pageSize: "10" }, body: { name: "Item" }, ...overrides }) as any;

describe("common controller behavior", () => {
  it("lists records with pagination and calculates totalPages", async () => {
    const model = { findMany: vi.fn().mockResolvedValue([{ id: 1 }]), count: vi.fn().mockResolvedValue(21) } as any;
    const res = response();
    await listResource(req(), res, model, { active: true }, { name: "asc" });
    expect(model.findMany).toHaveBeenCalledWith({ where: { active: true }, orderBy: { name: "asc" }, skip: 10, take: 10 });
    expect(model.count).toHaveBeenCalledWith({ where: { active: true } });
    expect(res.json).toHaveBeenCalledWith({ data: [{ id: 1 }], pagination: { page: 2, pageSize: 10, total: 21, totalPages: 3 } });
  });

  it("supports empty lists and successful get/create/update/delete responses", async () => {
    const model = {
      findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue({ id: "item-1" }), create: vi.fn().mockResolvedValue({ id: "new" }),
      update: vi.fn().mockResolvedValue({ id: "item-1", name: "Updated" }), delete: vi.fn().mockResolvedValue({}),
    } as any;
    const res = response();
    await listResource(req({ query: { page: "1", pageSize: "25" } }), res, model);
    await getResource(req(), res, model);
    await createResource(req(), res, model);
    await updateResource(req(), res, model);
    await deleteResource(req(), res, model);
    expect(res.json).toHaveBeenCalledWith({ data: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it("throws not-found and rejects empty updates before Prisma calls", async () => {
    const model = { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } as any;
    await expect(getResource(req(), response(), model)).rejects.toMatchObject({ statusCode: 404 });
    await expect(updateResource(req({ body: {} }), response(), model)).rejects.toMatchObject({ statusCode: 400 });
    expect(model.update).not.toHaveBeenCalled();
  });

  it("rejects malformed pagination and non-object update bodies", async () => {
    const model = { findMany: vi.fn(), count: vi.fn(), update: vi.fn() } as any;
    await expect(listResource(req({ query: { page: "bad", pageSize: "10" } }), response(), model)).rejects.toMatchObject({ statusCode: 400 });
    await expect(listResource(req({ query: { page: "1", pageSize: "101" } }), response(), model)).rejects.toMatchObject({ statusCode: 400 });
    await expect(updateResource(req({ body: null }), response(), model)).rejects.toMatchObject({ statusCode: 400 });
    await expect(updateResource(req({ body: [] }), response(), model)).rejects.toMatchObject({ statusCode: 400 });
    expect(model.findMany).not.toHaveBeenCalled();
    expect(model.count).not.toHaveBeenCalled();
    expect(model.update).not.toHaveBeenCalled();
  });

  it("propagates findMany and count failures from Promise.all", async () => {
    const findManyFailure = new Error("findMany failed");
    const findManyModel = { findMany: vi.fn().mockRejectedValue(findManyFailure), count: vi.fn().mockResolvedValue(1) } as any;
    await expect(listResource(req(), response(), findManyModel)).rejects.toBe(findManyFailure);

    const countFailure = new Error("count failed");
    const countModel = { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockRejectedValue(countFailure) } as any;
    await expect(listResource(req(), response(), countModel)).rejects.toBe(countFailure);
  });
});
