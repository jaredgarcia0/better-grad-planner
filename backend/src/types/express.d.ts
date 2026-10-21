import type { User } from "../../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: User;
    }
  }
}

export {};
