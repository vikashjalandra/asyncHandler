import { asyncHandler } from '../src/adapters/express';
import { TimeoutError } from '../src/core';

// Mock Express objects
function mockReq(overrides: Record<string, unknown> = {}) {
  return { ...overrides };
}

function mockRes() {
  const res: any = {
    headersSent: false,
    statusCode: 200,
    _json: null as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res._json = body; return res; },
  };
  return res;
}

function mockNext() {
  const fn: any = jest.fn();
  return fn;
}

describe('Express asyncHandler', () => {
  it('should call the handler and not call next on success', async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.json({ ok: true });
    });

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await handler(req, res, next);

    expect(res._json).toEqual({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next(err) when the handler throws', async () => {
    const error = new Error('express boom');
    const handler = asyncHandler(async () => { throw error; });

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('should send JSON error response when sendErrorResponse is true', async () => {
    const handler = asyncHandler(
      async () => { throw new Error('handler failed'); },
      { sendErrorResponse: true },
    );

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await handler(req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res._json).toEqual({ error: 'handler failed' });
  });

  it('should set 408 status for TimeoutError when sendErrorResponse is true', async () => {
    const handler = asyncHandler(
      async () => new Promise((r) => setTimeout(r, 500)),
      { sendErrorResponse: true, timeout: 10 },
    );

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await handler(req, res, next);

    expect(res.statusCode).toBe(408);
  });

  it('should pass the error to next() if headers are already sent', async () => {
    const error = new Error('after headers');
    const handler = asyncHandler(async () => { throw error; });

    const req = mockReq();
    const res = mockRes();
    res.headersSent = true;
    const next = mockNext();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
