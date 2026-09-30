import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

// Topic name constants — add more as the system grows
export const TOPICS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];

export interface EventEnvelope<T> {
  eventId: string;
  type: Topic;
  occurredAt: string;
  data: T;
}

/**
 * Records an event in the outbox using the caller's transaction client, so the event is
 * committed atomically with the state change. The outbox relay publishes it to Kafka.
 */
export const enqueueEvent = async <T extends Prisma.InputJsonObject>(
  tx: Prisma.TransactionClient,
  topic: Topic,
  data: T,
  key?: string,
): Promise<void> => {
  const envelope: EventEnvelope<T> = {
    eventId: randomUUID(),
    type: topic,
    occurredAt: new Date().toISOString(),
    data,
  };
  await tx.outboxEvent.create({
    data: { id: envelope.eventId, topic, key, payload: envelope as unknown as Prisma.InputJsonObject },
  });
};
