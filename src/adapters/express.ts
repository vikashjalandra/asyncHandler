/**
 * Express adapter
 *
 * Wraps an Express route handler / middleware so that rejected promises
 * are automatically forwarded to Express's next(err) error handler.
 *
 * @example
 * import { asyncHandler } from 'async-handler-universal/express';
 *
 * app.get('/users', asyncHandler(async (req, res) => {
 *   const users = await User.findAll();
 *   res.json(users);
 * }));
 */

import { AsyncHandlerOptions, TimeoutError, MaxRetryError } from '../core';
import {
  asyncHandler as coreAsyncHandler,
} from '../core';

// Express-compatible types (avoid hard dependency on @types/express at runtime)

/** Minimal Express-compatible request object. */
export interface Request {
  [key: string]: unknown;
}

/** Minimal Express-compatible response object. */
export interface Response {
  status(code: number): Response;
  json(body: unknown): Response;
  headersSent: boolean;
  [key: string]: unknown;
}

/** Express next() callback. */
export type NextFunction = (err?: unknown) => void;

/** An Express route handler / middleware function. */
export type ExpressRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

export interface ExpressAsyncHandlerOptions extends AsyncHandlerOptions {
  /** If true, send a generic 500 JSON response instead of calling next(err). Default: false */
  sendErrorResponse?: boolean;

  /** Custom status code for error responses (default: 500). */
  errorStatusCode?: number;
}

/**
 * Wraps an Express async route handler.
 */
export function asyncHandler(
  fn: ExpressRouteHandler,
  options: ExpressAsyncHandlerOptions = {},
): ExpressRouteHandler {
  const { sendErrorResponse = false, errorStatusCode = 500, ...coreOptions } = options;

  return async function expressAsyncHandler(req: Request, res: Response, next: NextFunction) {
    try {
      const wrapped = coreAsyncHandler(fn, {
        ...coreOptions,
        rethrow: true, // always rethrow so we can forward to next()
      });
      await wrapped(req, res, next);
    } catch (error) {
      if (res.headersSent) {
        return next(error);
      }

      if (sendErrorResponse) {
        const statusCode = error instanceof TimeoutError ? 408 : errorStatusCode;
        return res.status(statusCode).json({
          error: error instanceof Error ? error.message : 'Internal Server Error',
        });
      }

      next(error);
    }
  };
}

export { TimeoutError, MaxRetryError } from '../core';
export { tryCatch, withRetry } from '../core';
export type { AsyncHandlerOptions, WithRetryOptions, Result } from '../core';
