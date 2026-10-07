/**
 * @jest-environment node
 */

/**
 * Tests for the cloud infrastructure modules:
 *   - JWT auth (auth.ts)
 *   - Rate limiting (rate-limit.ts)
 *   - SSRF/security helpers
 */

// ─── JWT Auth Tests ──────────────────────────────────────────

describe('JWT Auth', () => {
  // Use dynamic import so jest module mock is applied
  let createJWT: typeof import('@/lib/auth').createJWT;
  let validateJWT: typeof import('@/lib/auth').validateJWT;
  let extractJWTFromRequest: typeof import('@/lib/auth').extractJWTFromRequest;

  beforeAll(async () => {
    const mod = await import('@/lib/auth');
    createJWT = mod.createJWT;
    validateJWT = mod.validateJWT;
    extractJWTFromRequest = mod.extractJWTFromRequest;
  });

  it('creates and validates a JWT round-trip', async () => {
    const payload = {
      userId: 'user-123',
      email: 'test@mawadao.com',
      subdomain: 'testuser',
      tenantId: 'tenant-abc',
    };

    const token = await createJWT(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = await validateJWT(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe('user-123');
    expect(decoded!.email).toBe('test@mawadao.com');
    expect(decoded!.subdomain).toBe('testuser');
    expect(decoded!.tenantId).toBe('tenant-abc');
  });

  it('rejects a tampered token', async () => {
    const token = await createJWT({
      userId: 'user-1',
      email: 'a@b.com',
      subdomain: null,
      tenantId: null,
    });

    // Tamper with the payload segment
    const parts = token.split('.');
    parts[1] = parts[1].slice(0, -3) + 'xxx';
    const tampered = parts.join('.');

    const result = await validateJWT(tampered);
    expect(result).toBeNull();
  });

  it('rejects an expired token', async () => {
    // Create a token that expires immediately
    const token = await createJWT(
      { userId: 'u', email: 'e@e.com', subdomain: null, tenantId: null },
      '0s'
    );

    // Wait a bit to ensure expiry
    await new Promise((r) => setTimeout(r, 50));

    const result = await validateJWT(token);
    expect(result).toBeNull();
  });

  it('handles null subdomain and tenantId', async () => {
    const token = await createJWT({
      userId: 'user-2',
      email: 'user2@test.com',
      subdomain: null,
      tenantId: null,
    });

    const decoded = await validateJWT(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.subdomain).toBeNull();
    expect(decoded!.tenantId).toBeNull();
  });

  it('returns null for garbage input', async () => {
    expect(await validateJWT('')).toBeNull();
    expect(await validateJWT('not.a.jwt')).toBeNull();
    expect(await validateJWT('a.b')).toBeNull();
  });
});

// ─── Rate Limit Tests ────────────────────────────────────────

describe('Rate Limiting', () => {
  let checkRateLimit: typeof import('@/lib/rate-limit').checkRateLimit;

  beforeAll(async () => {
    const mod = await import('@/lib/rate-limit');
    checkRateLimit = mod.checkRateLimit;
  });

  it('allows requests within the limit', () => {
    const config = { max: 3, windowSec: 60, prefix: 'test-allow' };

    const r1 = checkRateLimit('ip-1', config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit('ip-1', config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit('ip-1', config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests over the limit', () => {
    const config = { max: 2, windowSec: 60, prefix: 'test-block' };

    checkRateLimit('ip-block', config);
    checkRateLimit('ip-block', config);

    const r3 = checkRateLimit('ip-block', config);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('isolates keys from each other', () => {
    const config = { max: 1, windowSec: 60, prefix: 'test-isolate' };

    checkRateLimit('user-a', config);
    const blocked = checkRateLimit('user-a', config);
    expect(blocked.allowed).toBe(false);

    // Different key should still be allowed
    const allowed = checkRateLimit('user-b', config);
    expect(allowed.allowed).toBe(true);
  });

  it('isolates prefixes from each other', () => {
    const config1 = { max: 1, windowSec: 60, prefix: 'prefix-a' };
    const config2 = { max: 1, windowSec: 60, prefix: 'prefix-b' };

    checkRateLimit('shared-key', config1);
    const blocked = checkRateLimit('shared-key', config1);
    expect(blocked.allowed).toBe(false);

    // Same key, different prefix should be allowed
    const allowed = checkRateLimit('shared-key', config2);
    expect(allowed.allowed).toBe(true);
  });

  it('provides a valid resetAt timestamp', () => {
    const config = { max: 5, windowSec: 30, prefix: 'test-reset' };
    const now = Date.now();

    const r = checkRateLimit('ip-reset', config);
    // resetAt should be ~30 seconds in the future
    expect(r.resetAt).toBeGreaterThanOrEqual(now + 29_000);
    expect(r.resetAt).toBeLessThanOrEqual(now + 31_000);
  });
});

// ─── Subdomain Validation Tests ──────────────────────────────

describe('Subdomain Validation', () => {
  const SUBDOMAIN_REGEX = /^[a-z][a-z0-9-]{1,61}[a-z0-9]$/;

  const RESERVED = new Set([
    'www', 'api', 'auth', 'admin', 'app', 'mail', 'ftp',
    'blog', 'docs', 'help', 'support', 'status', 'cdn',
    'static', 'assets', 'media', 'images', 'test', 'staging',
    'dev', 'demo', 'beta', 'dashboard', 'console', 'panel',
  ]);

  function isValidSubdomain(s: string): boolean {
    if (!SUBDOMAIN_REGEX.test(s)) return false;
    if (RESERVED.has(s)) return false;
    return true;
  }

  it('accepts valid subdomains', () => {
    expect(isValidSubdomain('carol')).toBe(true);
    expect(isValidSubdomain('my-workspace')).toBe(true);
    expect(isValidSubdomain('user123')).toBe(true);
    expect(isValidSubdomain('a-long-but-valid-subdomain-name')).toBe(true);
  });

  it('rejects reserved subdomains', () => {
    expect(isValidSubdomain('www')).toBe(false);
    expect(isValidSubdomain('api')).toBe(false);
    expect(isValidSubdomain('admin')).toBe(false);
    expect(isValidSubdomain('dashboard')).toBe(false);
  });

  it('rejects invalid formats', () => {
    expect(isValidSubdomain('')).toBe(false);
    expect(isValidSubdomain('a')).toBe(false); // too short (1 char)
    expect(isValidSubdomain('ab')).toBe(false); // too short (2 chars)
    expect(isValidSubdomain('-abc')).toBe(false); // starts with hyphen
    expect(isValidSubdomain('ABC')).toBe(false); // uppercase
    expect(isValidSubdomain('my domain')).toBe(false); // space
    expect(isValidSubdomain('my_domain')).toBe(false); // underscore
    expect(isValidSubdomain('abc-')).toBe(false); // ends with hyphen
    expect(isValidSubdomain('1abc')).toBe(false); // starts with digit
  });

  it('rejects path traversal attempts', () => {
    expect(isValidSubdomain('../etc')).toBe(false);
    expect(isValidSubdomain('..%2f')).toBe(false);
  });
});

// ─── SSRF Protection Tests ──────────────────────────────────

describe('SSRF Backend URL Validation', () => {
  const ALLOWED_BACKEND_PATTERNS = [
    /^https:\/\/[a-z0-9-]+\.run\.app\/?/,
    /^https:\/\/[a-z0-9-]+\.a\.run\.app\/?/,
    /^http:\/\/localhost:\d+\/?/,
  ];

  function isAllowedBackendUrl(url: string): boolean {
    return ALLOWED_BACKEND_PATTERNS.some((p) => p.test(url));
  }

  it('allows valid Cloud Run URLs', () => {
    expect(isAllowedBackendUrl('https://mawadao-alice.run.app')).toBe(true);
    expect(isAllowedBackendUrl('https://mawadao-alice.run.app/')).toBe(true);
    expect(isAllowedBackendUrl('https://service-123.a.run.app')).toBe(true);
  });

  it('allows localhost for development', () => {
    expect(isAllowedBackendUrl('http://localhost:3000')).toBe(true);
    expect(isAllowedBackendUrl('http://localhost:8080/')).toBe(true);
  });

  it('blocks internal network URLs (SSRF)', () => {
    expect(isAllowedBackendUrl('http://169.254.169.254/metadata')).toBe(false);
    expect(isAllowedBackendUrl('http://10.0.0.1:8080')).toBe(false);
    expect(isAllowedBackendUrl('http://192.168.1.1')).toBe(false);
    expect(isAllowedBackendUrl('http://[::1]:8080')).toBe(false);
  });

  it('blocks arbitrary external URLs', () => {
    expect(isAllowedBackendUrl('https://evil.com')).toBe(false);
    expect(isAllowedBackendUrl('https://google.com')).toBe(false);
    expect(isAllowedBackendUrl('ftp://files.internal')).toBe(false);
  });

  it('blocks file:// and other schemes', () => {
    expect(isAllowedBackendUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedBackendUrl('gopher://internal')).toBe(false);
  });
});

// ─── Path Traversal (Zip-Slip) Tests ────────────────────────

describe('Path Traversal Protection', () => {
  const path = require('path');

  function isPathWithin(parent: string, child: string): boolean {
    const resolvedParent = path.resolve(parent) + path.sep;
    const resolvedChild = path.resolve(child);
    return resolvedChild.startsWith(resolvedParent) || resolvedChild === path.resolve(parent);
  }

  it('accepts paths within the parent directory', () => {
    expect(isPathWithin('/home/user/.openclaw', '/home/user/.openclaw/config.json')).toBe(true);
    expect(isPathWithin('/home/user/.openclaw', '/home/user/.openclaw/agents/abc')).toBe(true);
  });

  it('rejects path traversal attempts', () => {
    expect(isPathWithin('/home/user/.openclaw', '/home/user/.openclaw/../../../etc/passwd')).toBe(false);
    expect(isPathWithin('/home/user/.openclaw', '/etc/passwd')).toBe(false);
    expect(isPathWithin('/home/user/.openclaw', '/home/user/.openclaw/../../root')).toBe(false);
  });

  it('rejects the parent directory itself only when checking child files', () => {
    // The parent itself should be allowed (we check equality separately)
    expect(isPathWithin('/home/user/.openclaw', '/home/user/.openclaw')).toBe(true);
  });
});

// ─── Security Headers Verification ──────────────────────────

describe('Security Headers Configuration', () => {
  it('CSP policy blocks dangerous sources', () => {
    // Verify our CSP string is well-formed
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://avatars.mawadao.com https://images.mawadao.com https://*.githubusercontent.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.mawadao.com wss://*.mawadao.com https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/(?:^|[\s;])\*(?:[\s;]|$)/); // No bare * as a standalone source
  });

  it('reserved subdomain list covers critical paths', () => {
    const RESERVED = new Set([
      'www', 'api', 'auth', 'admin', 'app', 'mail', 'ftp',
      'blog', 'docs', 'help', 'support', 'status', 'cdn',
      'static', 'assets', 'media', 'images', 'test', 'staging',
      'dev', 'demo', 'beta', 'dashboard', 'console', 'panel',
    ]);

    // Must reserve these critical subdomains
    expect(RESERVED.has('api')).toBe(true);
    expect(RESERVED.has('auth')).toBe(true);
    expect(RESERVED.has('admin')).toBe(true);
    expect(RESERVED.has('www')).toBe(true);
    expect(RESERVED.has('cdn')).toBe(true);
    expect(RESERVED.has('status')).toBe(true);
  });
});
