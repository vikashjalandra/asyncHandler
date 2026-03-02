/**
 * async-handler-universal
 *
 * Universal async/await error handler for all Node.js frameworks.
 *
 * Main entry point — exports the core handler and all adapters
 * under namespaced objects for convenience.
 *
 * For tree-shaking, prefer deep imports:
 *   import { asyncHandler } from 'async-handler-universal/express';
 *
 * This barrel export is provided for convenience:
 *   import { express, koa, core } from 'async-handler-universal';
 */

// Core (framework-agnostic)
export {
  asyncHandler,
  tryCatch,
  withRetry,
  TimeoutError,
  MaxRetryError,
} from './core';
export type { AsyncHandlerOptions, WithRetryOptions, Result } from './core';

// Framework adapters — namespaced re-exports
import * as expressAdapter from './adapters/express';
import * as koaAdapter from './adapters/koa';
import * as fastifyAdapter from './adapters/fastify';
import * as hapiAdapter from './adapters/hapi';
import * as nextjsAdapter from './adapters/nextjs';

export const express = expressAdapter;
export const koa = koaAdapter;
export const fastify = fastifyAdapter;
export const hapi = hapiAdapter;
export const nextjs = nextjsAdapter;
