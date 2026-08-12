import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { MulterError } from "multer";
import ApiError from "../lib/ApiError.ts";
import logger from "../lib/logger.ts";
import cleanupUploads from "../lib/cleanupUploads.ts";
import env from "../config/index.ts";

interface ErrorBody {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

const classify = (err: unknown): ErrorBody => {
  if (err instanceof ApiError) {
    return {
      status: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    };
  }

  if (err instanceof SyntaxError && "body" in err) {
    return {
      status: 400,
      code: "INVALID_JSON",
      message: "Malformed JSON body",
    };
  }
  if (
    typeof err === "object" &&
    err !== null &&
    (err as { type?: string }).type === "entity.too.large"
  ) {
    return {
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "Body too large",
    };
  }

  if (err instanceof MulterError) {
    const multerErr = err as MulterError;
    return {
      status: multerErr.code === "LIMIT_FILE_SIZE" ? 413 : 400,
      code: multerErr.code,
      message: multerErr.message,
      details: multerErr.field ? { field: multerErr.field } : undefined,
    };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid request data",
      details: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    };
  }
  if (err instanceof mongoose.Error.CastError) {
    return { status: 400, code: "INVALID_ID", message: `Invalid ${err.path}` };
  }

  if ((err as { code?: number }).code === 11000) {
    return {
      status: 409,
      code: "CONFLICT",
      message: "Resource already exists",
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  };
};

const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const { status, code, message, details } = classify(err);

  void cleanupUploads(req);

  const log = req.log ?? logger;
  if (status >= 500) {
    log.error({ err, code, url: req.originalUrl }, "request failed");
  } else {
    log.warn({ code, status, url: req.originalUrl }, message);
  }

  if (res.headersSent) return _next(err);

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(env.NODE_ENV !== "production" && err instanceof Error
        ? { stack: err.stack }
        : {}),
    },
  });
};

export default errorHandler;
