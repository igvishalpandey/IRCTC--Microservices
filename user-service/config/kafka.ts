import { Kafka, Producer, Consumer, logLevel, CompressionTypes, Partitioners } from 'kafkajs';
import { env } from './env';
import { logger } from '../utils/logger';

const kafkaLogger = logger.child({ component: 'kafka' });

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.KAFKA_BROKER,
  logLevel: logLevel.WARN,
  logCreator:
    () =>
    ({ level, log }) => {
      const { message, timestamp: _timestamp, ...extra } = log;
      if (level <= logLevel.ERROR) kafkaLogger.error(extra, message);
      else kafkaLogger.warn(extra, message);
    },
});

let producer: Producer | null = null;
let connecting: Promise<Producer> | null = null;

export const getProducer = async (): Promise<Producer> => {
  if (producer) return producer;
  // Share a single in-flight connect so concurrent callers don't create multiple producers.
  connecting ??= (async () => {
    // Delivery is at-least-once via the outbox; consumers dedupe on the `event-id` header.
    // One in-flight request keeps per-partition ordering across retries.
    const p = kafka.producer({ maxInFlightRequests: 1, createPartitioner: Partitioners.DefaultPartitioner });
    await p.connect();
    logger.info('Kafka producer connected');
    producer = p;
    return p;
  })().finally(() => {
    connecting = null;
  });
  return connecting;
};

export const createConsumer = (groupId?: string): Consumer =>
  kafka.consumer({ groupId: groupId ?? env.KAFKA_GROUP_ID });

export const disconnectKafka = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    producer = null;
    logger.info('Kafka producer disconnected');
  }
};

export { CompressionTypes };
export default kafka;
