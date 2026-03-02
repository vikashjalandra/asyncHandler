/**
 * Hapi adapter
 *
 * Wraps a Hapi route handler so that rejected promises are caught
 * and toolkit.response() or Boom errors are returned properly.
 *
 * @example
 * import { asyncHandler } from 'async-handler-universal/hapi';
 *
 * server.route({
 *   method: 'GET',
 *   path: '/users',
 *   handler: asyncHandler(async (request, h) => {
 *     const users = await User.findAll();
 *     return users;
 *   }),
 * });
 */

import { AsyncHandlerOptions, TimeoutError, MaxRetryError } from '../core';
import { asyncHandler as coreAsyncHandler } from '../core';

/** Minimal Hapi-compatible request object. */
export interface HapiRequest {
  [key: string]: unknown;
}

/** Minimal Hapi response toolkit. */
export interface HapiResponseToolkit {
  response(value?: unknown): HapiResponseObject;
  continue: symbol;
  [key: string]: unknown;
}

/** Minimal Hapi response object. */
export interface HapiResponseObject {
  code(statusCode: number): HapiResponseObject;
  [key: string]: unknown;
}

/** A Hapi route handler function. */
export type HapiHandler = (request: HapiRequest, h: HapiResponseToolkit) => Promise<unknown> | unknown;

export interface HapiAsyncHandlerOptions extends AsyncHandlerOptions {
  /** If true, returns a Hapi response object with error info. Default: false (rethrows as Boom) */
  sendErrorResponse?: boolean;

  /** HTTP status code for error responses. Default: 500 */
  errorStatusCode?: number;
}

export function asyncHandler(
  fn: HapiHandler,
  options: HapiAsyncHandlerOptions = {},
): HapiHandler {
  const { sendErrorResponse = false, errorStatusCode = 500, ...coreOptions } = options;

  return async function hapiAsyncHandler(request: HapiRequest, h: HapiResponseToolkit) {
    try {
      const wrapped = coreAsyncHandler(fn, {
        ...coreOptions,
        rethrow: true,
      });
      return await wrapped(request, h);
    } catch (error) {
      if (sendErrorResponse) {
        const status = error instanceof TimeoutError ? 408 : errorStatusCode;
        return h.response({
          error: error instanceof Error ? error.message : 'Internal Server Error',
        }).code(status);
      }

      throw error; // Let Hapi / Boom handle the error
    }
  };
}

export { TimeoutError, MaxRetryError } from '../core';
export { tryCatch, withRetry } from '../core';
export type { AsyncHandlerOptions, WithRetryOptions, Result } from '../core';
