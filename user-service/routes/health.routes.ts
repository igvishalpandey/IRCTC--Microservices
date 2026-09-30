import { Router } from 'express';
import { pingDatabase } from '../config/database';

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
  try {
    await pingDatabase();
    res.status(200).json({ status: 'ok', checks: { database: 'ok' } });
  } catch {
    res.status(503).json({ status: 'unavailable', checks: { database: 'fail' } });
  }
});

router.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'user-service', timestamp: new Date().toISOString() });
});

export default router;
