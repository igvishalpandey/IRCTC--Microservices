import { Response } from 'express';
import { MESSAGES } from '../constants/messages';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = MESSAGES.COMMON.SUCCESS,
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response => {
  const response: ApiResponse<T> = { success: true, message, data };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const sendPaginated = <T>(
  res: Response,
  items: T[],
  { total, page, limit }: PaginationMeta,
  message: string = MESSAGES.COMMON.SUCCESS,
): Response =>
  sendSuccess(res, items, message, 200, {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
  });
