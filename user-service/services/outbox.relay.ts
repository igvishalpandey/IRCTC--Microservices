import prisma from '../config/database';
import { getProducer, CompressionTypes } from '../config/kafka';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const log = logger.child({ component: 'outbox-relay' });

// Arbitrary constant key for a Postgres advisory lock. Only one replica relays at a time,
// which keeps per-key event ordering intact when the service is scaled horizontally.
const RELAY_LOCK_KEY = 4_815_162_342;

interface OutboxRow {
  id: string;
  topic: string;
  key: string | null;
  payload: unknown;
}

let timer: NodeJS.Timeout | null = null;
let running: Promise<void> | null = null;
let stopped = true;

/** Publishes one batch of pending events. Returns the number published. */
export const relayOnce = async (): Promise<number> =>
  prisma.$transaction(
    async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${RELAY_LOCK_KEY}::bigint) AS locked`;
      if (!locked) return 0;

      const rows = await tx.$queryRaw<OutboxRow[]>`
        SELECT id, topic, key, payload
        FROM outbox_events
        WHERE "publishedAt" IS NULL
        ORDER BY "createdAt", id
        LIMIT ${env.OUTBOX_BATCH_SIZE}`;
      if (rows.length === 0) return 0;

      const byTopic = new Map<string, OutboxRow[]>();
      for (const row of rows) byTopic.set(row.topic, [...(byTopic.get(row.topic) ?? []), row]);

      const ids = rows.map((r) => r.id);
      try {
        const producer = await getProducer();
        await producer.sendBatch({
          compression: CompressionTypes.GZIP,
          topicMessages: [...byTopic].map(([topic, msgs]) => ({
            topic,
            messages: msgs.map((m) => ({
              key: m.key ?? undefined,
              value: JSON.stringify(m.payload),
              headers: { 'event-id': m.id },
            })),
          })),
        });
      } catch (err) {
        await tx.outboxEvent.updateMany({
          where: { id: { in: ids } },
          data: { attempts: { increment: 1 }, lastError: String((err as Error).message).slice(0, 1000) },
        });
        log.error({ err, count: rows.length }, 'Failed to publish outbox batch; will retry');
        return 0;
      }

      await tx.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: { publishedAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
      log.debug({ count: rows.length }, 'Published outbox batch');
      return rows.length;
    },
    { timeout: 30_000, maxWait: 5_000 },
  );

const tick = async (): Promise<void> => {
  if (stopped) return;
  let published = 0;
  running = relayOnce()
    .then((n) => {
      published = n;
    })
    .catch((err) => log.error({ err }, 'Outbox relay iteration failed'));
  await running;
  running = null;
  if (stopped) return;
  // Drain immediately while there is a backlog, otherwise wait for the poll interval.
  timer = setTimeout(tick, published >= env.OUTBOX_BATCH_SIZE ? 0 : env.OUTBOX_POLL_INTERVAL_MS);
};

export const startOutboxRelay = (): void => {
  if (!stopped) return;
  stopped = false;
  log.info('Outbox relay started');
  void tick();
};

export const stopOutboxRelay = async (): Promise<void> => {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
  await running;
  log.info('Outbox relay stopped');
};
