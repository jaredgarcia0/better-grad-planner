declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        id: string;
        email: string;
        emailVerifiedAt: Date | null;
      };
    }
  }
}

export {};
