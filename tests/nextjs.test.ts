import { asyncHandler } from '../src/adapters/nextjs';
import { asyncRouteHandler } from '../src/adapters/nextjs';

function mockNextReq(overrides: Record<string, unknown> = {}): any {
  return { method: 'GET', query: {}, ...overrides };
}

function mockNextRes(): any {
  const res: any = {
    headersSent: false,
    statusCode: 200,
    _json: null as unknown,
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res._json = body; },
    end() {},
  };
  return res;
}

describe('Next.js Pages Router asyncHandler', () => {
  it('should call the handler successfully', async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const req = mockNextReq();
    const res = mockNextRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._json).toEqual({ ok: true });
  });

  it('should return a 500 JSON error when the handler throws', async () => {
    const handler = asyncHandler(async () => { throw new Error('next boom'); });

    const req = mockNextReq();
    const res = mockNextRes();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._json).toEqual({ error: 'next boom' });
  });
});

describe('Next.js App Router asyncRouteHandler', () => {
  it('should return the Response on success', async () => {
    const handler = asyncRouteHandler(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const req = new Request('http://localhost/api/test');
    const result = await handler(req);

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body).toEqual({ ok: true });
  });

  it('should return a 500 JSON Response when the handler throws', async () => {
    const handler = asyncRouteHandler(async () => { throw new Error('app boom'); });

    const req = new Request('http://localhost/api/test');
    const result = await handler(req);

    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body).toEqual({ error: 'app boom' });
  });
});
