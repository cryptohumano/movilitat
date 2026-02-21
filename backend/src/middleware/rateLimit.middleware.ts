import { Request, Response, NextFunction } from 'express';
import { withRedis } from '../lib/redis.js';

export type RateLimitOptions = {
  /** Prefijo de la clave Redis, ej. "login" -> ratelimit:login:IP */
  keyPrefix: string;
  /** Ventana en segundos */
  windowSeconds: number;
  /** Máximo de intentos en la ventana */
  maxAttempts: number;
};

/**
 * Obtiene IP del request (considera X-Forwarded-For si hay proxy).
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

/**
 * Middleware de rate limit usando Redis.
 * Clave: ratelimit:{keyPrefix}:{IP}. Si Redis no está disponible, deja pasar (next).
 */
export function rateLimit(options: RateLimitOptions) {
  const { keyPrefix, windowSeconds, maxAttempts } = options;
  const keyPrefixFull = `ratelimit:${keyPrefix}:`;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = getClientIp(req);
    const key = `${keyPrefixFull}${ip}`;

    const current = await withRedis(async (redis) => {
      const multi = redis.multi();
      multi.incr(key);
      multi.ttl(key);
      const results = await multi.exec();
      if (!results) return null;
      const [, incrResult] = results[0] ?? [];
      const [, ttlResult] = results[1] ?? [];
      const count = Number(incrResult);
      const ttl = Number(ttlResult);
      // Si era la primera vez en esta ventana, fijar TTL
      if (count === 1 && ttl === -1) {
        await redis.expire(key, windowSeconds);
      }
      return count;
    });

    // Redis no disponible: no bloquear
    if (current === undefined || current === null) {
      next();
      return;
    }

    if (current > maxAttempts) {
      res.set('Retry-After', String(windowSeconds));
      res.status(429).json({
        success: false,
        message: 'Demasiados intentos. Espera un momento antes de volver a intentar.',
      });
      return;
    }

    next();
  };
}

const isProduction = process.env.NODE_ENV === 'production';

/** Rate limit para login. En producción: 5 intentos por IP cada 15 min. En desarrollo: 5 intentos cada 15 s. */
export const loginRateLimit = rateLimit({
  keyPrefix: isProduction ? 'login' : 'login:dev',
  windowSeconds: isProduction ? 15 * 60 : 15,
  maxAttempts: 5,
});
