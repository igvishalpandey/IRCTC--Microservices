import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger.middleware';
import { corsMiddleware } from './middleware/cors.middleware';
import { createRateLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import userRoutes from './routes/user.routes';
import healthRoutes from './routes/health.routes';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestLogger);
  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  app.use('/health', healthRoutes);

  app.use('/api', createRateLimiter());
  app.use('/api/users', userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
