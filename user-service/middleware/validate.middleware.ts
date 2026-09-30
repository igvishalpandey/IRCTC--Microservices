import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export interface Validated {
  body: unknown;
  params: unknown;
  query: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    validated?: Validated;
  }
}

export const validate =
  (schemas: Schemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.validated = {
      body: schemas.body ? schemas.body.parse(req.body) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
    };
    next();
  };
