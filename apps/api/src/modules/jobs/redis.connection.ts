/** BullMQ/ioredis connection options parsed from a redis:// URL. */
export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  /** Required by BullMQ for blocking clients (Worker/QueueEvents). */
  maxRetriesPerRequest: null;
  /** Defer connecting until first use so module construction never hits Redis. */
  lazyConnect: boolean;
}

export function redisConnection(url: string): RedisConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.password ? { password: parsed.password } : {}),
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}
