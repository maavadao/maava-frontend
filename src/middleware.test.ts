/**
 * @jest-environment node
 *
 * Middleware unit tests — exercises subdomain detection, auth redirects,
 * transfer-token pass-through, and the main-domain redirect flow.
 *
 * Because ROOT_DOMAIN and CLOUD_MODE are module-level constants evaluated at
 * import time, we use jest.isolateModules() + dynamic require().
 */
import type { NextRequest as NextRequestType } from 'next/server';
import type * as AuthModule from '@/lib/auth';

type MiddlewareFn = (req: NextRequestType) => Promise<Response>;

function getModules() {
    let mw!: MiddlewareFn;
    let mockedAuth!: jest.Mocked<typeof AuthModule>;
    let NextRequest!: typeof NextRequestType;

    jest.isolateModules(() => {
        jest.doMock('@/lib/auth', () => ({
            validateJWT: jest.fn(),
            createTransferToken: jest.fn(),
        }));
        const midMod = require('./middleware');
        mw = midMod.middleware;
        mockedAuth = require('@/lib/auth') as jest.Mocked<typeof AuthModule>;
        NextRequest = require('next/server').NextRequest;
    });

    return { mw, mockedAuth, NextRequest };
}

function buildRequest(
    NextReq: typeof NextRequestType,
    url: string,
    opts?: {
        cookies?: Record<string, string>;
        headers?: Record<string, string>;
    },
) {
    const req = new NextReq(new URL(url), {
        headers: new Headers(opts?.headers || {}),
    });
    if (opts?.cookies) {
        for (const [k, v] of Object.entries(opts.cookies)) {
            req.cookies.set(k, v);
        }
    }
    return req;
}

beforeAll(() => {
    process.env.NEXT_PUBLIC_CLOUD_MODE = 'true';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'mawadao.com';
});

afterEach(() => jest.restoreAllMocks());

// ── Tests ──────────────────────────────────────────────────────────

describe('unauthenticated subdomain request', () => {
    test('redirects to login with correct redirect param', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(null);

        const req = buildRequest(NextRequest, 'https://alice.mawadao.com/some/path?q=1', {
            headers: { 'x-forwarded-host': 'alice.mawadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(307);
        const location = res?.headers.get('location') || '';
        expect(location).toContain('mawadao.com/auth/login');
        expect(location).toContain(encodeURIComponent('alice.mawadao.com'));
    });
});

describe('transfer token on subdomain (pass-through)', () => {
    test('auth_token present + no user → rewrite (let page handle exchange)', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(null);

        const req = buildRequest(
            NextRequest,
            'https://alice.mawadao.com/?auth_token=transfer123&state=abc',
            { headers: { 'x-forwarded-host': 'alice.mawadao.com' } },
        );

        const res = await mw(req);
        // Should rewrite (200), NOT redirect — let the client-side JS handle the exchange
        expect(res?.status).toBe(200);
        expect(res?.headers.get('x-subdomain')).toBe('alice');
        expect(res?.headers.get('x-needs-token-exchange')).toBe('1');
    });

    test('auth_token present + valid user → strips params and redirects to clean URL', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue({
            userId: 'user-1',
            email: 'ali@example.com',
            subdomain: 'alice',
            tenantId: 'tenant-1',
        });

        const req = buildRequest(
            NextRequest,
            'https://alice.mawadao.com/?auth_token=old_token&state=x',
            {
                cookies: { 'auth-token': 'valid-jwt' },
                headers: { 'x-forwarded-host': 'alice.mawadao.com' },
            },
        );

        const res = await mw(req);
        expect(res?.status).toBe(307);
        const location = res?.headers.get('location') || '';
        expect(location).not.toContain('auth_token');
        expect(location).not.toContain('state=x');
        expect(location).toContain('alice.mawadao.com');
    });
});

describe('authenticated user on subdomain', () => {
    test('matching subdomain → passes through with routing headers', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue({
            userId: 'user-1',
            email: 'ali@example.com',
            subdomain: 'alice',
            tenantId: 'tenant-1',
        });

        const req = buildRequest(NextRequest, 'https://alice.mawadao.com/', {
            cookies: { 'auth-token': 'valid-jwt' },
            headers: { 'x-forwarded-host': 'alice.mawadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(200);
        expect(res?.headers.get('x-subdomain')).toBe('alice');
        expect(res?.headers.get('x-tenant-id')).toBe('tenant-1');
    });

    test('mismatched subdomain → rewrite to /unauthorized', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue({
            userId: 'user-1',
            email: 'ali@example.com',
            subdomain: 'other',
            tenantId: 'tenant-1',
        });

        const req = buildRequest(NextRequest, 'https://alice.mawadao.com/', {
            cookies: { 'auth-token': 'valid-jwt' },
            headers: { 'x-forwarded-host': 'alice.mawadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(200); // rewrite, not redirect
    });
});

describe('main domain with authenticated user and subdomain', () => {
    test('redirects to subdomain WITH transfer token', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue({
            userId: 'user-1',
            email: 'ali@example.com',
            subdomain: 'alice',
            tenantId: 'tenant-1',
        });
        mockedAuth.createTransferToken.mockResolvedValue('xfer-token-123');

        const req = buildRequest(NextRequest, 'https://mawadao.com/', {
            cookies: { 'auth-token': 'valid-jwt' },
            headers: { 'x-forwarded-host': 'mawadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(307);
        const location = res?.headers.get('location') || '';
        expect(location).toContain('alice.mawadao.com');
        expect(location).toContain('auth_token=xfer-token-123');
        expect(location).toContain('state=');
    });
});

describe('authenticated user on /auth/login', () => {
    test('user without subdomain is redirected away from login page', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue({
            userId: 'user-1',
            email: 'ali@example.com',
            subdomain: null as any,
            tenantId: null as any,
        });

        const req = buildRequest(NextRequest, 'https://mawadao.com/auth/login', {
            cookies: { 'auth-token': 'valid-jwt' },
            headers: { 'x-forwarded-host': 'mawadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(307);
        const location = res?.headers.get('location') || '';
        expect(location).toMatch(/\/$/);
    });
});

describe('main domain — no auth', () => {
    test('login page is accessible when not authenticated', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(null);

        const req = buildRequest(NextRequest, 'https://mawadao.com/auth/login', {
            headers: { 'x-forwarded-host': 'mawadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(200);
    });

    test('protected route redirects to login', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(null);

        const req = buildRequest(NextRequest, 'https://mawadao.com/settings', {
            headers: { 'x-forwarded-host': 'mawadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(307);
        const location = res?.headers.get('location') || '';
        expect(location).toContain('/auth/login');
    });
});

describe('protocol resolution', () => {
    test('forces https for *.mawadao.com even with http x-forwarded-proto', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(null);

        const req = buildRequest(NextRequest, 'http://alice.mawadao.com/', {
            headers: {
                'x-forwarded-host': 'alice.mawadao.com',
                'x-forwarded-proto': 'http',
            },
        });

        const res = await mw(req);
        expect(res?.status).toBe(307);
        const location = res?.headers.get('location') || '';
        expect(location).toContain('https://');
    });
});
