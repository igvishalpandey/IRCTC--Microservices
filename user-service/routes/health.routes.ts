import { Router } from 'express';
import { pingDatabase } from '../config/database';
import { redis, pingRedis } from '../config/redis';

const router = Router();

let shuttingDown = false;
export const markShuttingDown = (): void => {
  shuttingDown = true;
};

router.get('/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/ready', async (_req, res) => {
  if (shuttingDown) {
    res.status(503).json({ status: 'shutting_down' });
    return;
  }

  const [database, cache] = await Promise.allSettled([pingDatabase(), pingRedis()]);
  const checks: Record<string, string> = { database: database.status === 'fulfilled' ? 'ok' : 'fail' };
  if (redis) checks.redis = cache.status === 'fulfilled' ? 'ok' : 'fail';

  // The database is required. Redis is not: rate limiting fails open without it, so a Redis
  // outage reports "degraded" but keeps the pod in rotation.
  if (checks.database === 'fail') {
    res.status(503).json({ status: 'unavailable', checks });
    return;
  }
  res.status(200).json({ status: checks.redis === 'fail' ? 'degraded' : 'ok', checks });
});

router.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'user-service', timestamp: new Date().toISOString() });
});

export default router;
