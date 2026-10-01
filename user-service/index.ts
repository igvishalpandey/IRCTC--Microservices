import { env } from './config/env';
import { logger } from './utils/logger';
import { createApp } from './app';
import prisma from './config/database';
import { disconnectKafka } from './config/kafka';
import { disconnectRedis } from './config/redis';
import { startOutboxRelay, stopOutboxRelay } from './services/outbox.relay';
import { markShuttingDown } from './routes/health.routes';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'User service listening');
});

// Keep-alive must outlive the load balancer's idle timeout to avoid 502s on reused sockets.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

if (env.KAFKA_ENABLED) startOutboxRelay();

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
let shuttingDown = false;

const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  markShuttingDown();
  logger.info({ reason }, 'Shutting down gracefully');

  // Hard deadline so a stuck connection can't block the deploy forever.
  setTimeout(() => {
    logger.fatal('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS).unref();

  try {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    server.closeIdleConnections();
    await stopOutboxRelay();
    await disconnectKafka();
    await prisma.$disconnect();
    await disconnectRedis();
    logger.info('All connections closed');
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    exitCode = 1;
  }
  logger.flush();
  process.exit(exitCode);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  void shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});
