import pino from 'pino';
import { env, isProduction } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'user-service', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never let credentials or PII-bearing headers reach the log pipeline.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.email',
    ],
    censor: '[REDACTED]',
  },
  // JSON in production (for log shippers); human-readable locally.
  ...(!isProduction &&
    env.NODE_ENV !== 'test' && {
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } },
    }),
});
