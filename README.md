# async-handler-universal

> Universal async/await error handler for **all** Node.js frameworks — Express, Koa, Fastify, Hapi, Next.js, and any other npm-based JS runtime.

Stop writing repetitive `try/catch` blocks in every route handler. This package provides a single, consistent API across frameworks with built-in **retries**, **timeouts**, **exponential backoff**, and a Go-style **`tryCatch`** tuple helper.

---

## Features

- **Framework-agnostic core** — works with any async function
- **Express** adapter — auto-forwards errors to `next(err)`
- **Koa** adapter — integrates with Koa's error handling / `ctx.throw`
- **Fastify** adapter — adds timeout & retry on top of Fastify's native async support
- **Hapi** adapter — returns proper `h.response()` error objects
- **Next.js** adapter — Pages Router & App Router (Route Handlers)
- **Retry with exponential backoff** — configurable attempts, delay, and backoff factor
- **Timeouts** — reject long-running handlers with `TimeoutError`
- **`tryCatch`** — Go-style `[error, result]` tuple for any promise
- **`withRetry`** — standalone retry utility
- **TypeScript-first** — full type declarations included
- **Dual CJS/ESM** — works with `require()` and `import`
- **Zero runtime dependencies** — all framework types are optional peer deps
- **Tree-shakeable** — use deep imports for minimal bundle size

---

## Installation

```bash
npm install async-handler-universal
```

---

## Quick Start

### Framework-Agnostic (Core)

```ts
import { asyncHandler, tryCatch, withRetry } from 'async-handler-universal';

// Wrap any async function
const safeFetch = asyncHandler(
  async (url: string) => {
    const res = await fetch(url);
    return res.json();
  },
  {
    retries: 3,
    retryDelay: 1000,
    backoffFactor: 2,
    timeout: 5000,
    onError: (err) => console.error('Failed:', err),
  }
);

const data = await safeFetch('https://api.example.com/data');

// Go-style error handling
const [err, result] = await tryCatch(fetch('/api'));
if (err) {
  console.error(err);
}

// Standalone retry
const data2 = await withRetry(() => fetch('/flaky-api'), {
  maxRetries: 3,
  delay: 500,
  backoff: 2,
});
```

---

### Express

```ts
import { asyncHandler } from 'async-handler-universal/express';

// Errors automatically forwarded to next(err)
app.get('/users', asyncHandler(async (req, res) => {
  const users = await User.findAll();
  res.json(users);
}));

// With auto JSON error response
app.get('/users', asyncHandler(
  async (req, res) => {
    const users = await User.findAll();
    res.json(users);
  },
  { sendErrorResponse: true, timeout: 5000 }
));
```

---

### Koa

```ts
import { asyncHandler } from 'async-handler-universal/koa';

router.get('/users', asyncHandler(async (ctx) => {
  ctx.body = await User.findAll();
}));

// Use ctx.throw for error responses
router.get('/users', asyncHandler(
  async (ctx) => { /* ... */ },
  { useCtxThrow: true, errorStatusCode: 503 }
));
```

---

### Fastify

```ts
import { asyncHandler } from 'async-handler-universal/fastify';

fastify.get('/users', asyncHandler(async (request, reply) => {
  return await User.findAll();
}));

// With retry and timeout
fastify.get('/external', asyncHandler(
  async (request, reply) => {
    return await callExternalApi();
  },
  { retries: 2, timeout: 3000, sendErrorResponse: true }
));
```

---

### Hapi

```ts
import { asyncHandler } from 'async-handler-universal/hapi';

server.route({
  method: 'GET',
  path: '/users',
  handler: asyncHandler(async (request, h) => {
    const users = await User.findAll();
    return users;
  }),
});
```

---

### Next.js — Pages Router

```ts
// pages/api/users.ts
import { asyncHandler } from 'async-handler-universal/nextjs';

export default asyncHandler(async (req, res) => {
  const users = await getUsers();
  res.status(200).json(users);
});
```

### Next.js — App Router

```ts
// app/api/users/route.ts
import { asyncRouteHandler } from 'async-handler-universal/nextjs';

export const GET = asyncRouteHandler(async (req) => {
  const users = await getUsers();
  return Response.json(users);
});
```

---

## API Reference

### `asyncHandler(fn, options?)`

Wraps an async function with error handling, retry, and timeout capabilities.

| Option | Type | Default | Description |
|---|---|---|---|
| `onError` | `(error, ...args) => void` | — | Called when the function rejects |
| `rethrow` | `boolean` | `false` | Re-throw the error after `onError` |
| `timeout` | `number` | — | Timeout in ms; rejects with `TimeoutError` |
| `retries` | `number` | `0` | Number of retry attempts |
| `retryDelay` | `number` | `0` | Delay between retries (ms) |
| `backoffFactor` | `number` | `1` | Multiplier applied to delay each retry |
| `onRetry` | `(error, attempt) => void` | — | Called before each retry |

### `tryCatch(promise)`

Returns a `[error, result]` tuple — never throws.

```ts
const [err, data] = await tryCatch(someAsyncOperation());
```

### `withRetry(fn, options?)`

Standalone retry utility.

| Option | Type | Default | Description |
|---|---|---|---|
| `maxRetries` | `number` | `3` | Max retry attempts |
| `delay` | `number` | `0` | Delay between retries (ms) |
| `backoff` | `number` | `1` | Exponential backoff multiplier |
| `onRetry` | `(error, attempt) => void` | — | Called before each retry |

### Error Classes

- **`TimeoutError`** — thrown when a timeout is exceeded
- **`MaxRetryError`** — thrown when all retries are exhausted (has `.lastError` and `.attempts`)

---

## Framework Adapter Options

Each adapter extends the core options with framework-specific settings:

| Adapter | Extra Options |
|---|---|
| **Express** | `sendErrorResponse`, `errorStatusCode` |
| **Koa** | `useCtxThrow`, `errorStatusCode` |
| **Fastify** | `sendErrorResponse`, `errorStatusCode` |
| **Hapi** | `sendErrorResponse`, `errorStatusCode` |
| **Next.js** | `errorStatusCode` |

---

## Importing

### Tree-shakeable deep imports (recommended)

```ts
import { asyncHandler } from 'async-handler-universal/express';
import { asyncHandler } from 'async-handler-universal/koa';
import { asyncHandler } from 'async-handler-universal/fastify';
import { asyncHandler } from 'async-handler-universal/hapi';
import { asyncHandler, asyncRouteHandler } from 'async-handler-universal/nextjs';
import { asyncHandler, tryCatch, withRetry } from 'async-handler-universal/core';
```

### Barrel import

```ts
import { express, koa, fastify, hapi, nextjs, tryCatch } from 'async-handler-universal';

app.get('/users', express.asyncHandler(async (req, res) => { /* ... */ }));
```

### CommonJS

```js
const { asyncHandler } = require('async-handler-universal/express');
```

---

## Requirements

- Node.js >= 14
- TypeScript >= 4.7 (optional, for type checking)

## License

MIT
