/**
 * Fastify adapter
 *
 * Wraps a Fastify route handler so that rejected promises are caught.
 * Fastify already handles async errors natively, but this adapter adds
 * retry, timeout, and custom error-handling capabilities.
 *
 * @example
 * import { asyncHandler } from 'async-handler-universal/fastify';
 *
 * fastify.get('/users', asyncHandler(async (request, reply) => {
 *   const users = await User.findAll();
 *   return users;
 * }));
 */

import { AsyncHandlerOptions, TimeoutError, MaxRetryError } from '../core';
import { asyncHandler as coreAsyncHandler } from '../core';

/** Minimal Fastify-compatible request object. */
export interface FastifyRequest {
  [key: string]: unknown;
}

/** Minimal Fastify-compatible reply object. */
export interface FastifyReply {
  code(statusCode: number): FastifyReply;
  send(payload?: unknown): FastifyReply;
  sent: boolean;
  [key: string]: unknown;
}

/** A Fastify route handler function. */
export type FastifyHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> | unknown;

export interface FastifyAsyncHandlerOptions extends AsyncHandlerOptions {
  /** If true, send a JSON error response instead of letting Fastify handle it. Default: false */
  sendErrorResponse?: boolean;

  /** HTTP status code for error responses. Default: 500 */
  errorStatusCode?: number;
}

export function asyncHandler(
  fn: FastifyHandler,
  options: FastifyAsyncHandlerOptions = {},
): FastifyHandler {
  const { sendErrorResponse = false, errorStatusCode = 500, ...coreOptions } = options;

  return async function fastifyAsyncHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
      const wrapped = coreAsyncHandler(fn, {
        ...coreOptions,
        rethrow: true,
      });
      return await wrapped(request, reply);
    } catch (error) {
      if (sendErrorResponse && !reply.sent) {
        const status = error instanceof TimeoutError ? 408 : errorStatusCode;
        return reply.code(status).send({
          error: error instanceof Error ? error.message : 'Internal Server Error',
        });
      }

      throw error; // Let Fastify's built-in error handling deal with it
    }
  };
}

export { TimeoutError, MaxRetryError } from '../core';
export { tryCatch, withRetry } from '../core';
export type { AsyncHandlerOptions, WithRetryOptions, Result } from '../core';
