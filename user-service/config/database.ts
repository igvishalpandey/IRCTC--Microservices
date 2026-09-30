import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('query', (e) => logger.trace({ durationMs: e.duration, query: e.query }, 'prisma query'));
prisma.$on('warn', (e) => logger.warn({ target: e.target }, e.message));
prisma.$on('error', (e) => logger.error({ target: e.target }, e.message));

export const pingDatabase = async (): Promise<void> => {
  await prisma.$queryRaw`SELECT 1`;
};

export default prisma;
