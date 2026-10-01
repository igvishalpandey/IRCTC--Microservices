import { describe, it, expect, vi } from 'vitest';
import type { RedisReply } from 'rate-limit-redis';
import { SelfHealingRedisStore } from '../middleware/rateLimit.middleware';

// Fake Redis: fails every command while `down`, otherwise answers like the real Lua scripts.
const fakeRedis = () => {
  const state = { down: true };
  const sendCommand = vi.fn(async (command: string): Promise<RedisReply> => {
    if (state.down) throw new Error('connect ECONNREFUSED');
    if (command === 'SCRIPT') return 'sha1';
    return [1, 60_000];
  });
  return { state, sendCommand };
};

describe('SelfHealingRedisStore', () => {
  it('recovers after Redis was down during initialisation', async () => {
    const { state, sendCommand } = fakeRedis();
    const store = new SelfHealingRedisStore({ sendCommand });

    // Boot while Redis is down: script loading fails.
    await expect(store.init({ windowMs: 60_000 } as never)).rejects.toThrow('ECONNREFUSED');
    await expect(store.increment('client')).rejects.toThrow('ECONNREFUSED');

    // Redis comes back: the next increment reloads the scripts and succeeds.
    state.down = false;
    await expect(store.increment('client')).rejects.toThrow(); // still holds the reload started while down
    const result = await store.increment('client');
    expect(result.totalHits).toBe(1);
  });

  it('does not raise unhandled rejections while Redis stays down', async () => {
    const { sendCommand } = fakeRedis();
    const store = new SelfHealingRedisStore({ sendCommand });
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);

    await store.init({ windowMs: 60_000 } as never).catch(() => undefined);
    for (let i = 0; i < 3; i++) await store.increment('client').catch(() => undefined);
    await new Promise((r) => setTimeout(r, 20));

    process.off('unhandledRejection', onUnhandled);
    expect(onUnhandled).not.toHaveBeenCalled();
  });
});
