import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../utils/errors';
import { MESSAGES } from '../constants/messages';

interface ErrorBody {
  success: false;
  message: string;
  code: ErrorCode;
  requestId?: string;
  details?: unknown;
}

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const appError = AppError.from(err);

  if (appError.statusCode >= 500) {
    req.log.error({ err: appError.cause ?? appError, code: appError.code }, appError.message);
  } else {
    req.log.warn({ code: appError.code, message: appError.message }, 'Request failed');
  }

  if (res.headersSent) {
    res.destroy();
    return;
  }

  const body: ErrorBody = {
    success: false,
    message: appError.publicMessage,
    code: appError.code,
    requestId: String(req.id),
  };
  if (appError.details !== undefined) body.details = appError.details;

  res.status(appError.statusCode).json(body);
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(MESSAGES.COMMON.ROUTE_NOT_FOUND(req.method, req.path)));
};
