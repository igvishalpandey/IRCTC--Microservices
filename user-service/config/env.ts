import 'dotenv/config';
import { z } from 'zod';

const csv = z.string().transform((v) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Credentials are allowed cross-origin, so a bare "*" would let any site act as the user.
  CORS_ORIGINS: csv
    .default('')
    .refine((origins) => !origins.includes('*'), 'Use explicit origins or "https://*.domain", not "*"'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  DATABASE_URL: z.string().url(),

  KAFKA_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  KAFKA_BROKER: csv.default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('user-service'),
  KAFKA_GROUP_ID: z.string().default('user-service-group'),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(100),

  // Optional. When unset, rate limiting falls back to per-process memory.
  REDIS_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export type Env = typeof env;
