import {
  asyncHandler,
  tryCatch,
  withRetry,
  TimeoutError,
  MaxRetryError,
} from '../src/core';

// ─── asyncHandler ────────────────────────────────────────────────────────────

describe('asyncHandler (core)', () => {
  it('should return the value of a successful async function', async () => {
    const fn = async (x: number) => x * 2;
    const wrapped = asyncHandler(fn);
    expect(await wrapped(5)).toBe(10);
  });

  it('should return undefined when an error is caught and rethrow is false', async () => {
    const fn = async () => { throw new Error('boom'); };
    const wrapped = asyncHandler(fn);
    expect(await wrapped()).toBeUndefined();
  });

  it('should call onError when the function throws', async () => {
    const onError = jest.fn();
    const error = new Error('fail');
    const fn = async () => { throw error; };
    const wrapped = asyncHandler(fn, { onError });
    await wrapped();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should rethrow the error when rethrow is true', async () => {
    const fn = async () => { throw new Error('rethrown'); };
    const wrapped = asyncHandler(fn, { rethrow: true });
    await expect(wrapped()).rejects.toThrow('rethrown');
  });

  it('should preserve `this` context', async () => {
    const obj = {
      value: 42,
      fn: asyncHandler(async function (this: { value: number }) {
        return this.value;
      }),
    };
    expect(await obj.fn()).toBe(42);
  });
});

// ─── Timeout ─────────────────────────────────────────────────────────────────

describe('asyncHandler timeout', () => {
  it('should reject with TimeoutError when timeout is exceeded', async () => {
    const fn = async () => new Promise((r) => setTimeout(r, 500));
    const wrapped = asyncHandler(fn, { timeout: 50, rethrow: true });
    await expect(wrapped()).rejects.toThrow(TimeoutError);
  });

  it('should succeed if the function resolves before the timeout', async () => {
    const fn = async () => 'ok';
    const wrapped = asyncHandler(fn, { timeout: 1000 });
    expect(await wrapped()).toBe('ok');
  });
});

// ─── Retries ─────────────────────────────────────────────────────────────────

describe('asyncHandler retries', () => {
  it('should retry the specified number of times', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new Error('not yet');
      return 'done';
    };
    const wrapped = asyncHandler(fn, { retries: 3 });
    expect(await wrapped()).toBe('done');
    expect(calls).toBe(3);
  });

  it('should call onRetry before each retry attempt', async () => {
    const onRetry = jest.fn();
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw new Error('fail');
      return 'ok';
    };
    const wrapped = asyncHandler(fn, { retries: 2, onRetry });
    await wrapped();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it('should throw MaxRetryError when all retries are exhausted and rethrow is true', async () => {
    const fn = async () => { throw new Error('always fails'); };
    const wrapped = asyncHandler(fn, { retries: 2, rethrow: true });
    await expect(wrapped()).rejects.toThrow(MaxRetryError);
  });

  it('should support exponential backoff (completes within expected window)', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'ok';
    };
    const start = Date.now();
    const wrapped = asyncHandler(fn, { retries: 3, retryDelay: 20, backoffFactor: 2 });
    expect(await wrapped()).toBe('ok');
    const elapsed = Date.now() - start;
    // 1st retry: 20ms, 2nd retry: 40ms → total ~60ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

// ─── tryCatch ────────────────────────────────────────────────────────────────

describe('tryCatch', () => {
  it('should return [null, value] for a resolved promise', async () => {
    const [err, val] = await tryCatch(Promise.resolve(42));
    expect(err).toBeNull();
    expect(val).toBe(42);
  });

  it('should return [Error, undefined] for a rejected promise', async () => {
    const [err, val] = await tryCatch(Promise.reject(new Error('bad')));
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toBe('bad');
    expect(val).toBeUndefined();
  });

  it('should wrap non-Error rejections into Error objects', async () => {
    const [err] = await tryCatch(Promise.reject('string error'));
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toBe('string error');
  });
});

// ─── withRetry ───────────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('should succeed on the first try if no error', async () => {
    const result = await withRetry(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('should retry and eventually succeed', async () => {
    let attempt = 0;
    const result = await withRetry(async () => {
      attempt++;
      if (attempt < 3) throw new Error('fail');
      return 'success';
    }, { maxRetries: 3 });
    expect(result).toBe('success');
    expect(attempt).toBe(3);
  });

  it('should throw MaxRetryError after all retries exhausted', async () => {
    await expect(
      withRetry(async () => { throw new Error('always'); }, { maxRetries: 2 }),
    ).rejects.toThrow(MaxRetryError);
  });

  it('should call onRetry callback', async () => {
    const onRetry = jest.fn();
    let attempt = 0;
    await withRetry(async () => {
      attempt++;
      if (attempt < 2) throw new Error('fail');
      return 'ok';
    }, { maxRetries: 2, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
