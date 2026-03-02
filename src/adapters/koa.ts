/**
 * Koa adapter
 *
 * Wraps a Koa middleware so that rejected promises are caught
 * and the error is set on ctx, letting Koa's error handling take over.
 *
 * @example
 * import { asyncHandler } from 'async-handler-universal/koa';
 *
 * router.get('/users', asyncHandler(async (ctx) => {
 *   ctx.body = await User.findAll();
 * }));
 */

import { AsyncHandlerOptions, TimeoutError, MaxRetryError } from '../core';
import { asyncHandler as coreAsyncHandler } from '../core';

/** Minimal Koa-compatible context object. */
export interface KoaContext {
  status: number;
  body: unknown;
  throw(status: number, message?: string): void;
  app: { emit(event: string, err: unknown, ctx: unknown): void };
  [key: string]: unknown;
}

/** Koa next() callback. */
export type KoaNext = () => Promise<void>;

/** A Koa middleware function. */
export type KoaMiddleware = (ctx: KoaContext, next: KoaNext) => Promise<void> | void;

export interface KoaAsyncHandlerOptions extends AsyncHandlerOptions {
  /** If true, ctx.throw() is used instead of re-throwing. Default: false */
  useCtxThrow?: boolean;

  /** HTTP status code when using ctx.throw. Default: 500 */
  errorStatusCode?: number;
}

export function asyncHandler(
  fn: KoaMiddleware,
  options: KoaAsyncHandlerOptions = {},
): KoaMiddleware {
  const { useCtxThrow = false, errorStatusCode = 500, ...coreOptions } = options;

  return async function koaAsyncHandler(ctx: KoaContext, next: KoaNext) {
    try {
      const wrapped = coreAsyncHandler(fn, {
        ...coreOptions,
        rethrow: true,
      });
      await wrapped(ctx, next);
    } catch (error) {
      if (useCtxThrow) {
        const status = error instanceof TimeoutError ? 408 : errorStatusCode;
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        ctx.throw(status, message);
      } else {
        throw error; // Let Koa's built-in error handling deal with it
      }
    }
  };
}

export { TimeoutError, MaxRetryError } from '../core';
export { tryCatch, withRetry } from '../core';
export type { AsyncHandlerOptions, WithRetryOptions, Result } from '../core';
