import type { NextFunction, Request, Response } from 'express';
import { hostGuard } from '../../src/common/host-guard.js';

function check(headers: Record<string, string>, method = 'GET', allowed: string[] = []) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  hostGuard(allowed)({ headers, method } as Request, res as unknown as Response, next as NextFunction);
  return next.mock.calls.length ? 'allowed' : res.status.mock.calls[0][0];
}

describe('hostGuard', () => {
  test.each(['localhost:8080', '127.0.0.1:8080', '[::1]:8080', '192.168.1.20', 'mybox.local:8080'])('answers to %s', (host) => {
    expect(check({ host })).toBe('allowed');
  });

  test.each(['evil.example', 'localhost.evil.example', '', 'bad host'])('refuses %j', (host) => {
    expect(check({ host })).toBe(403);
  });

  test('answers to names in ALLOWED_HOSTS', () => {
    expect(check({ host: 'mybox:8080' }, 'GET', ['mybox'])).toBe('allowed');
  });

  test('refuses writes from another origin, but not reads', () => {
    const headers = { host: 'localhost:8080', origin: 'https://evil.example' };
    expect(check(headers, 'POST')).toBe(403);
    expect(check({ ...headers, origin: 'null' }, 'DELETE')).toBe(403);
    expect(check(headers, 'GET')).toBe('allowed');
  });

  test('allows writes from its own origin', () => {
    expect(check({ host: 'localhost:8080', origin: 'http://localhost:8080' }, 'POST')).toBe('allowed');
  });
});
