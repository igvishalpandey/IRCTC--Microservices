import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

const log = logger.child({ component: 'redis' });

const createClient = (url: string): Redis => {
  const client = new Redis(url, {
    connectionName: 'user-service',
    connectTimeout: 5_000,
    // Fail commands fast while Redis is unreachable instead of queueing them for long.
    maxRetriesPerRequest: 1,
    // Keep reconnecting with capped backoff; callers degrade gracefully meanwhile.
    retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
  });

  client.on('ready', () => log.info('Redis connected'));
  // An 'error' listener is required: without one, ioredis errors crash the process.
  client.on('error', (err) => log.error({ err }, 'Redis error'));
  client.on('reconnecting', (delayMs: number) => log.warn({ delayMs }, 'Redis reconnecting'));

  return client;
};

/** Shared Redis client, or null when REDIS_URL is not configured (Redis is optional). */
export const redis: Redis | null = env.REDIS_URL ? createClient(env.REDIS_URL) : null;

export const pingRedis = async (): Promise<void> => {
  if (!redis) return;
  await redis.ping();
};

export const disconnectRedis = async (): Promise<void> => {
  if (!redis || redis.status === 'end') return;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
  log.info('Redis disconnected');
};
