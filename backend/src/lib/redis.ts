/**
 * Cliente Redis centralizado.
 * Acepta REDIS_URL (Railway, etc.) o REDIS_HOST + REDIS_PORT + REDIS_PASSWORD.
 * Si no está configurado, las operaciones fallan en silencio (degradación graceful).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Redis = require('ioredis') as new (opts?: object | string, opts2?: object) => {
  quit: () => Promise<string>;
  on: (ev: string, fn: (err?: Error) => void) => void;
  get: (key: string) => Promise<string | null>;
  set: (key: string, val: string, ...args: string[]) => Promise<string>;
  del: (key: string) => Promise<number>;
  multi: () => { incr: (k: string) => unknown; ttl: (k: string) => unknown; exec: () => Promise<unknown[][] | null> };
  expire: (key: string, seconds: number) => Promise<string>;
};

let client: InstanceType<typeof Redis> | null = null;

const redisOptions = {
  maxRetriesPerRequest: 2,
  retryStrategy(times: number) {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
};

function getRedisConfig(): { host: string; port: number; password?: string } | null {
  const host = process.env.REDIS_HOST ?? process.env.REDISHOST;
  const port = process.env.REDIS_PORT ?? process.env.REDISPORT;
  const numPort = port ? parseInt(String(port), 10) : 6379;
  if (!host?.trim()) return null;
  return {
    host: host.trim(),
    port: Number.isFinite(numPort) ? numPort : 6379,
    ...((process.env.REDIS_PASSWORD ?? process.env.REDISPASSWORD)?.trim() && {
      password: (process.env.REDIS_PASSWORD ?? process.env.REDISPASSWORD)!.trim(),
    }),
  };
}

/**
 * Obtiene el cliente Redis (singleton). Crea la conexión en el primer uso.
 * Devuelve null si Redis no está configurado o si la conexión falla.
 */
export function getRedis(): InstanceType<typeof Redis> | null {
  if (client !== null) return client;
  const url = process.env.REDIS_URL?.trim();
  const config = getRedisConfig();
  if (!url && !config) return null;
  try {
    if (url) {
      client = new Redis(url, redisOptions);
    } else {
      client = new Redis({ ...config, ...redisOptions });
    }
    client.on('error', (err?: Error) => {
      console.warn('[redis] Error:', err?.message ?? 'unknown');
    });
    client.on('connect', () => {
      console.log('[redis] Connected');
    });
  } catch (e) {
    console.warn('[redis] No se pudo crear el cliente:', e);
    return null;
  }
  return client;
}

/**
 * Ejecuta una operación con Redis. Si Redis no está disponible, devuelve undefined
 * (para que el caller pueda degradar: p. ej. no aplicar rate limit).
 */
export async function withRedis<T>(
  fn: (redis: InstanceType<typeof Redis>) => Promise<T>
): Promise<T | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;
  try {
    return await fn(redis);
  } catch (e) {
    console.warn('[redis] Operación fallida:', e);
    return undefined;
  }
}

/**
 * Cierra la conexión Redis (útil en tests o shutdown graceful).
 */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
