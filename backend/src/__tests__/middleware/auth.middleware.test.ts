import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { authenticate, requireRole } from '../../middleware/auth';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

describe('authenticate middleware', () => {
  const verifyMock = jwt.verify as jest.Mock;

  const createResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockImplementation(function status(this: Response, code: number) {
      (res as Response).statusCode = code;
      return this;
    }) as any;
    res.json = jest.fn().mockImplementation(function json(this: Response, body: unknown) {
      (res as any).body = body;
      return this;
    }) as any;
    return res as Response & { body?: unknown };
  };

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (prisma.user.findUnique as jest.Mock | undefined)?.mockReset?.();
    verifyMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects when authorization header missing', async () => {
    const req = { headers: {} } as unknown as Request;
    const res = createResponse();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Authentication required' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when token invalid', async () => {
    const req = { headers: { authorization: 'Bearer bad' } } as unknown as Request;
    const res = createResponse();
    const next = jest.fn();
    verifyMock.mockImplementation(() => { throw new Error('bad token'); });

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Invalid token' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when user not found', async () => {
    const req = { headers: { authorization: 'Bearer token' } } as unknown as Request;
    const res = createResponse();
    const next = jest.fn();
    verifyMock.mockReturnValue({ userId: 'user-1', email: 'test@example.com' });
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Invalid token' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user and calls next when valid', async () => {
    const req = { headers: { authorization: 'Bearer token' } } as unknown as Request;
    const res = createResponse();
    const next = jest.fn();
    verifyMock.mockReturnValue({ userId: 'user-1', email: 'test@example.com' });
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
      id: 'user-1',
      email: 'test@example.com',
      role: 'ADMIN',
    } as any);

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as Request).user).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      role: 'ADMIN',
    });
  });
});

describe('requireRole middleware', () => {
  const createResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockImplementation(function status(this: Response, code: number) {
      (res as Response).statusCode = code;
      return this;
    }) as any;
    res.json = jest.fn().mockImplementation(function json(this: Response, body: unknown) {
      (res as any).body = body;
      return this;
    }) as any;
    return res as Response & { body?: unknown };
  };

  it('rejects when user missing', () => {
    const req = {} as Request;
    const res = createResponse();
    const next = jest.fn();

    requireRole('ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Authentication required' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when role mismatched', () => {
    const req = { user: { role: 'USER' } } as Request;
    const res = createResponse();
    const next = jest.fn();

    requireRole('ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Insufficient permissions' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when role matches', () => {
    const req = { user: { role: 'ADMIN' } } as Request;
    const res = createResponse();
    const next = jest.fn();

    requireRole('ADMIN')(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
