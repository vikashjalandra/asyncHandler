import { asyncHandler } from '../src/adapters/koa';

function mockCtx(overrides: Record<string, unknown> = {}): any {
  return {
    status: 200,
    body: null,
    throw(status: number, message?: string) {
      const err: any = new Error(message || 'Error');
      err.status = status;
      throw err;
    },
    app: { emit: jest.fn() },
    ...overrides,
  };
}

const mockNext = () => jest.fn(async () => {});

describe('Koa asyncHandler', () => {
  it('should call the middleware and set ctx.body on success', async () => {
    const handler = asyncHandler(async (ctx) => {
      ctx.body = { ok: true };
    });

    const ctx = mockCtx();
    await handler(ctx, mockNext());

    expect(ctx.body).toEqual({ ok: true });
  });

  it('should rethrow errors by default (Koa error handling)', async () => {
    const handler = asyncHandler(async () => { throw new Error('koa boom'); });
    const ctx = mockCtx();
    await expect(handler(ctx, mockNext())).rejects.toThrow('koa boom');
  });

  it('should use ctx.throw when useCtxThrow is true', async () => {
    const handler = asyncHandler(
      async () => { throw new Error('ctx throw test'); },
      { useCtxThrow: true },
    );

    const ctx = mockCtx();
    // ctx.throw will throw an error with a status property
    await expect(handler(ctx, mockNext())).rejects.toThrow();
  });
});
