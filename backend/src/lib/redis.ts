/**
 * Cliente Redis centralizado.
 * Si REDIS_HOST no está definido o Redis no está disponible, las operaciones
 * fallan en silencio (degradación graceful) para no bloquear la app.
 */
import Redis from 'ioredis';

let client: Redis | null = null;

function getRedisConfig(): { host: string; port: number; password?: string } | null {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
  if (!host?.trim()) return null;
  return {
    host: host.trim(),
    port: Number.isFinite(port) ? port : 6379,
    ...(process.env.REDIS_PASSWORD?.trim() && { password: process.env.REDIS_PASSWORD.trim() }),
  };
}

/**
 * Obtiene el cliente Redis (singleton). Crea la conexión en el primer uso.
 * Devuelve null si Redis no está configurado o si la conexión falla.
 */
export function getRedis(): Redis | null {
  if (client !== null) return client;
  const config = getRedisConfig();
  if (!config) return null;
  try {
    client = new Redis({
      ...config,
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    client.on('error', (err) => {
      console.warn('[redis] Error:', err.message);
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
  fn: (redis: Redis) => Promise<T>
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
