import type { Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";
import { pagination, response } from "../utils/parse.js";

export type Model = {
  findMany: (args: any) => Promise<any[]>;
  count: (args: any) => Promise<number>;
  findUnique: (args: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

type Page = { page: number; pageSize: number; skip: number; take: number };

type ListOptions = {
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
};

export function idFrom(req: Request): string {
  return req.params.id as string;
}

export function queryValue(req: Request, key: string): string | undefined {
  return req.query[key] as string | undefined;
}

function pageFrom(req: Request): Page {
  return pagination(req.query as Record<string, unknown>);
}

export async function listResource(
  req: Request,
  res: Response,
  model: Model,
  where: Record<string, unknown> = {},
  orderBy: Record<string, string> = { name: "asc" },
  options: ListOptions = {},
) {
  const page = pageFrom(req);
  const query = {
    where,
    orderBy,
    skip: page.skip,
    take: page.take,
    ...(options.select ? { select: options.select } : {}),
    ...(options.include ? { include: options.include } : {}),
  };
  const [data, total] = await Promise.all([
    model.findMany(query),
    model.count({ where }),
  ]);
  res.json(response(data, page, total));
}

export async function getResource(req: Request, res: Response, model: Model) {
  const record = await model.findUnique({ where: { id: idFrom(req) } });
  if (!record) throw new HttpError(404, "The requested record was not found.");
  res.json({ data: record });
}

export async function createResource(req: Request, res: Response, model: Model) {
  const record = await model.create({ data: req.body });
  res.status(201).json({ data: record });
}

export async function updateResource(req: Request, res: Response, model: Model) {
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    throw new HttpError(400, "Update body must be an object.");
  }
  const data = req.body as Record<string, unknown>;
  if (Object.keys(data).length === 0) {
    throw new HttpError(400, "At least one field must be supplied for an update.");
  }
  const record = await model.update({ where: { id: idFrom(req) }, data });
  res.json({ data: record });
}

export async function deleteResource(req: Request, res: Response, model: Model) {
  await model.delete({ where: { id: idFrom(req) } });
  res.status(204).send();
}
