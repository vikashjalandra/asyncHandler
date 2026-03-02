/**
 * async-handler-universal — Core Module
 *
 * Framework-agnostic async utilities for wrapping functions,
 * handling errors, retrying, and managing timeouts.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AsyncHandlerOptions {
  /** Custom error handler called when the wrapped function rejects. */
  onError?: (error: unknown, ...args: unknown[]) => void | Promise<void>;

  /** If true, rethrow the error after calling onError (default: false). */
  rethrow?: boolean;

  /** Optional timeout in milliseconds. Rejects with TimeoutError if exceeded. */
  timeout?: number;

  /** Number of retry attempts on failure (default: 0 = no retries). */
  retries?: number;

  /** Delay between retries in ms (default: 0). */
  retryDelay?: number;

  /** Exponential backoff multiplier applied to retryDelay (default: 1). */
  backoffFactor?: number;

  /** Called before each retry with (error, attemptNumber). */
  onRetry?: (error: unknown, attempt: number) => void | Promise<void>;
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Async operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export class MaxRetryError extends Error {
  public lastError: unknown;
  public attempts: number;

  constructor(attempts: number, lastError: unknown) {
    super(`Async operation failed after ${attempts} attempt(s)`);
    this.name = 'MaxRetryError';
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ─── Core: asyncHandler ──────────────────────────────────────────────────────

/**
 * Wraps any async function so rejected promises are caught automatically.
 *
 * Works standalone as a generic wrapper — no framework coupling.
 *
 * @example
 * const safeFn = asyncHandler(async (x: number) => {
 *   if (x < 0) throw new Error('negative');
 *   return x * 2;
 * });
 */
export function asyncHandler<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn> | TReturn,
  options: AsyncHandlerOptions = {},
): (...args: TArgs) => Promise<TReturn | undefined> {
  const {
    onError,
    rethrow = false,
    timeout,
    retries = 0,
    retryDelay = 0,
    backoffFactor = 1,
    onRetry,
  } = options;

  return async function asyncHandlerWrapper(this: unknown, ...args: TArgs): Promise<TReturn | undefined> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        let resultPromise = Promise.resolve(fn.apply(this, args));

        if (timeout && timeout > 0) {
          resultPromise = withTimeout(resultPromise, timeout);
        }

        return await resultPromise;
      } catch (error) {
        lastError = error;

        // If we have more attempts left, call onRetry and wait
        if (attempt <= retries) {
          if (onRetry) {
            await onRetry(error, attempt);
          }
          const waitTime = retryDelay * Math.pow(backoffFactor, attempt - 1);
          if (waitTime > 0) {
            await delay(waitTime);
          }
          continue;
        }

        // Final attempt failed
        if (onError) {
          await onError(error, ...args);
        }
        if (rethrow) {
          if (retries > 0) {
            throw new MaxRetryError(attempt, error);
          }
          throw error;
        }
      }
    }

    return undefined;
  };
}

// ─── Utility: tryCatch tuple ─────────────────────────────────────────────────

export type Result<T> = [null, T] | [Error, undefined];

/**
 * Awaits a promise and returns a Go-style [error, result] tuple.
 *
 * @example
 * const [err, data] = await tryCatch(fetchUser(id));
 * if (err) return handleError(err);
 */
export async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error instanceof Error ? error : new Error(String(error)), undefined];
  }
}

// ─── Utility: withRetry standalone ───────────────────────────────────────────

/** Options for the standalone {@link withRetry} utility. */
export interface WithRetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;

  /** Delay in ms between retries (default: 0). */
  delay?: number;

  /** Exponential backoff multiplier applied to delay (default: 1). */
  backoff?: number;

  /** Called before each retry with (error, attemptNumber). */
  onRetry?: (err: unknown, attempt: number) => void;
}

/**
 * Retries an async function up to `maxRetries` times.
 *
 * @example
 * const data = await withRetry(() => fetch('/api'), { maxRetries: 3, delay: 1000 });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: WithRetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, delay: retryDelay = 0, backoff = 1, onRetry: onRetryFn } = opts;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt <= maxRetries) {
        if (onRetryFn) onRetryFn(error, attempt);
        const waitTime = retryDelay * Math.pow(backoff, attempt - 1);
        if (waitTime > 0) await delay(waitTime);
      }
    }
  }

  throw new MaxRetryError(maxRetries + 1, lastError);
}
