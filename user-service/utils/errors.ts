import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export const ERROR_STATUS = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface AppErrorOptions {
  details?: unknown;
  cause?: unknown;
  expose?: boolean;
}

const GENERIC_SERVER_MESSAGE = 'Internal Server Error';

const PRISMA_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(code: ErrorCode, message: string, { details, cause, expose }: AppErrorOptions = {}) {
    super(message, { cause });
    this.name = new.target.name;
    this.code = code;
    this.statusCode = ERROR_STATUS[code];
    this.details = details;
    this.expose = expose ?? this.statusCode < 500;
  }

  get publicMessage(): string {
    return this.expose ? this.message : GENERIC_SERVER_MESSAGE;
  }

  static badRequest(message = 'Bad request', details?: unknown) {
    return new AppError('BAD_REQUEST', message, { details });
  }

  static validation(details: unknown, message = 'Validation failed') {
    return new AppError('VALIDATION_ERROR', message, { details });
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError('UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError('FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new AppError('NOT_FOUND', message);
  }

  static conflict(message = 'Resource already exists') {
    return new AppError('CONFLICT', message);
  }

  static unprocessable(message: string, details?: unknown) {
    return new AppError('UNPROCESSABLE_ENTITY', message, { details });
  }

  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new AppError('TOO_MANY_REQUESTS', message);
  }

  static internal(message = GENERIC_SERVER_MESSAGE, cause?: unknown) {
    return new AppError('INTERNAL_ERROR', message, { cause });
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', cause?: unknown) {
    return new AppError('SERVICE_UNAVAILABLE', message, { cause, expose: true });
  }

  static from(err: unknown): AppError {
    if (err instanceof AppError) return err;

    if (err instanceof ZodError) {
      return new AppError('VALIDATION_ERROR', 'Validation failed', {
        details: err.flatten().fieldErrors,
        cause: err,
      });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return new AppError('CONFLICT', 'Resource already exists', { cause: err });
      if (err.code === 'P2025') return new AppError('NOT_FOUND', 'Resource not found', { cause: err });
      if (PRISMA_UNAVAILABLE_CODES.has(err.code)) return AppError.serviceUnavailable(undefined, err);
    }

    if (err instanceof Prisma.PrismaClientInitializationError) {
      return AppError.serviceUnavailable(undefined, err);
    }
    const type = (err as { type?: unknown } | null)?.type;
    if (type === 'entity.too.large') {
      return new AppError('PAYLOAD_TOO_LARGE', 'Request body is too large', { cause: err });
    }
    if (type === 'entity.parse.failed') {
      return new AppError('BAD_REQUEST', 'Malformed JSON body', { cause: err });
    }
    const status = (err as { status?: unknown } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return new AppError('BAD_REQUEST', 'Invalid request', { cause: err });
    }

    return AppError.internal(undefined, err);
  }
}

export const isAppError = (err: unknown): err is AppError => err instanceof AppError;
