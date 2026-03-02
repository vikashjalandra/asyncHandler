/**
 * Next.js adapter
 *
 * Wraps Next.js API route handlers (Pages Router & App Router)
 * so that unhandled promise rejections are caught and a proper
 * JSON error response is returned.
 *
 * @example — Pages Router (pages/api/users.ts)
 * import { asyncHandler } from 'async-handler-universal/nextjs';
 *
 * export default asyncHandler(async (req, res) => {
 *   const users = await getUsers();
 *   res.status(200).json(users);
 * });
 *
 * @example — App Router (app/api/users/route.ts)
 * import { asyncRouteHandler } from 'async-handler-universal/nextjs';
 *
 * export const GET = asyncRouteHandler(async (req) => {
 *   const users = await getUsers();
 *   return Response.json(users);
 * });
 */

import { AsyncHandlerOptions, TimeoutError, MaxRetryError } from '../core';
import { asyncHandler as coreAsyncHandler } from '../core';

// ─── Pages Router types ──────────────────────────────────────────────────────

interface NextApiRequest {
  method?: string;
  body?: unknown;
  query: Record<string, string | string[] | undefined>;
  [key: string]: unknown;
}

interface NextApiResponse {
  status(code: number): NextApiResponse;
  json(body: unknown): void;
  end(): void;
  headersSent: boolean;
  [key: string]: unknown;
}

type NextApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | unknown;

// ─── App Router types ────────────────────────────────────────────────────────

type NextAppRouteHandler = (req: Request, context?: unknown) => Promise<Response> | Response;

// ─── Options ─────────────────────────────────────────────────────────────────

export interface NextAsyncHandlerOptions extends AsyncHandlerOptions {
  /** HTTP status code for error responses. Default: 500 */
  errorStatusCode?: number;
}

// ─── Pages Router handler ────────────────────────────────────────────────────

/**
 * Wraps a Next.js Pages Router API handler.
 */
export function asyncHandler(
  fn: NextApiHandler,
  options: NextAsyncHandlerOptions = {},
): NextApiHandler {
  const { errorStatusCode = 500, ...coreOptions } = options;

  return async function nextAsyncHandler(req: NextApiRequest, res: NextApiResponse) {
    try {
      const wrapped = coreAsyncHandler(fn, {
        ...coreOptions,
        rethrow: true,
      });
      await wrapped(req, res);
    } catch (error) {
      if (!res.headersSent) {
        const status = error instanceof TimeoutError ? 408 : errorStatusCode;
        res.status(status).json({
          error: error instanceof Error ? error.message : 'Internal Server Error',
        });
      }
    }
  };
}

// ─── App Router handler ─────────────────────────────────────────────────────

/**
 * Wraps a Next.js App Router route handler (GET, POST, etc.).
 */
export function asyncRouteHandler(
  fn: NextAppRouteHandler,
  options: NextAsyncHandlerOptions = {},
): NextAppRouteHandler {
  const { errorStatusCode = 500, ...coreOptions } = options;

  return async function nextAppAsyncHandler(req: Request, context?: unknown) {
    try {
      const wrapped = coreAsyncHandler(fn, {
        ...coreOptions,
        rethrow: true,
      });
      const result = await wrapped(req, context);
      return result as Response;
    } catch (error) {
      const status = error instanceof TimeoutError ? 408 : errorStatusCode;
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal Server Error',
        }),
        {
          status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  };
}

export { TimeoutError, MaxRetryError } from '../core';
export { tryCatch, withRetry } from '../core';
export type { AsyncHandlerOptions, WithRetryOptions, Result } from '../core';
