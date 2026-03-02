import { asyncHandler } from '../src/adapters/fastify';

function mockRequest(overrides: Record<string, unknown> = {}): any {
  return { ...overrides };
}

function mockReply(): any {
  const reply: any = {
    sent: false,
    statusCode: 200,
    _payload: null as unknown,
    code(status: number) { reply.statusCode = status; return reply; },
    send(payload?: unknown) { reply._payload = payload; reply.sent = true; return reply; },
  };
  return reply;
}

describe('Fastify asyncHandler', () => {
  it('should return the handler result on success', async () => {
    const handler = asyncHandler(async () => ({ users: [] }));
    const result = await handler(mockRequest(), mockReply());
    expect(result).toEqual({ users: [] });
  });

  it('should rethrow errors by default (Fastify handles them)', async () => {
    const handler = asyncHandler(async () => { throw new Error('fastify boom'); });
    await expect(handler(mockRequest(), mockReply())).rejects.toThrow('fastify boom');
  });

  it('should send JSON error response when sendErrorResponse is true', async () => {
    const handler = asyncHandler(
      async () => { throw new Error('handled'); },
      { sendErrorResponse: true, errorStatusCode: 503 },
    );

    const reply = mockReply();
    await handler(mockRequest(), reply);

    expect(reply.statusCode).toBe(503);
    expect(reply._payload).toEqual({ error: 'handled' });
  });
});
