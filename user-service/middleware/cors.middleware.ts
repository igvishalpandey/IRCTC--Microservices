import cors, { CorsOptions } from 'cors';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const toMatcher = (pattern: string): ((origin: string) => boolean) => {
  if (!pattern.includes('*')) return (origin) => origin === pattern;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped.replace('*', '[a-z0-9-]+(?:\\.[a-z0-9-]+)*')}$`, 'i');
  return (origin) => regex.test(origin);
};

const matchers = env.CORS_ORIGINS.map(toMatcher);

export const isOriginAllowed = (origin: string): boolean => matchers.some((match) => match(origin));

const options: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin)) return callback(null, true);

    logger.warn({ origin }, 'CORS origin rejected');
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
  maxAge: 600,
};

export const corsMiddleware = cors(options);
