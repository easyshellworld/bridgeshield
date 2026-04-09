import rateLimit from 'express-rate-limit';
import { logger } from './logger';

export const createRateLimiter = (options?: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  const windowMs = options?.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
  const max = options?.max || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
  
  const limiter = rateLimit({
    windowMs,
    max,
    message: options?.message || {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    skipSuccessfulRequests: options?.skipSuccessfulRequests || false,
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        url: req.url,
        method: req.method,
        limit: max,
        window: `${windowMs}ms`
      });
      
      res.status(options.statusCode).json(options.message);
    },
    keyGenerator: (req) => {
      return req.ip || 'unknown';
    }
  });
  
  return limiter;
};

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many API requests from this IP, please try again after 15 minutes.'
});

export const checkRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many risk check requests, please slow down.'
});

export const appealRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many appeal requests, please try again later.'
});