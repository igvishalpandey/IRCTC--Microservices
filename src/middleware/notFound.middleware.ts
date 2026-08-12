import type { Request, Response, NextFunction } from "express";
import ApiError from "../lib/ApiError.ts";

const notFound = (req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
};

export default notFound;
