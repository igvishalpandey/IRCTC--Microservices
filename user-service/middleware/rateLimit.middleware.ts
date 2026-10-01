import { rateLimit, Store, IncrementResponse } from 'express-rate-limit';
import { RedisStore, RedisReply } from 'rate-limit-redis';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * RedisStore caches its Lua script SHAs as promises. If Redis is down when the store
 * initialises, those promises stay rejected and every later call fails even after Redis
 * recovers. Reload the scripts after a failure so rate limiting resumes on its own.
 */
export class SelfHealingRedisStore extends RedisStore {
  override async increment(key: string): Promise<IncrementResponse> {
    try {
      return await super.increment(key);
    } catch (err) {
      this.reloadScripts();
      throw err;
    }
  }

  private reloadScripts(): void {
    this.incrementScriptSha = this.loadIncrementScript();
    this.getScriptSha = this.loadGetScript();
    // Mark as handled so a failed reload can't surface as an unhandled rejection.
    this.incrementScriptSha.catch(() => undefined);
    this.getScriptSha.catch(() => undefined);
  }
}

const createStore = (): Store | undefined => {
  if (!redis) return undefined; // express-rate-limit falls back to its in-memory store
  const client = redis;
  return new SelfHealingRedisStore({
    prefix: 'user-service:rl:',
    sendCommand: (command: string, ...args: string[]) => client.call(command, ...args) as Promise<RedisReply>,
  });
};

/**
 * API rate limiter. Uses Redis when configured so limits are shared across replicas;
 * otherwise each process counts on its own. Create one per app (stores can't be shared).
 */
export const createRateLimiter = () =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: createStore(),
    // If Redis is unavailable, let requests through rather than failing the whole API.
    passOnStoreError: true,
    logger: logger.child({ component: 'rate-limit' }),
    // Route through the error handler so 429s use the standard JSON error envelope.
    handler: (_req, _res, next) => next(AppError.tooManyRequests()),
  });
