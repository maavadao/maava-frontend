/**
 * @jest-environment node
 *
 * Middleware unit tests — auth redirects on the main site and sending members
 * with a workspace to the member space.
 *
 * Because CLOUD_MODE and the member-space URL are module-level constants
 * evaluated at import time, we use jest.isolateModules() + dynamic require().
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

const member = {
    userId: 'user-1',
    email: 'alice@example.com',
    subdomain: 'alice',
    tenantId: 'tenant-1',
};

const newUser = {
    userId: 'user-2',
    email: 'bob@example.com',
    subdomain: null as any,
    tenantId: null as any,
};

beforeAll(() => {
    process.env.NEXT_PUBLIC_CLOUD_MODE = 'true';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'maavadao.com';
    process.env.NEXT_PUBLIC_MEMBER_SPACE_URL = 'https://agent.maavadao.com';
});

afterEach(() => jest.restoreAllMocks());

// ── Tests ──────────────────────────────────────────────────────────

describe('member with a workspace', () => {
    test('is sent from the main site to their own space', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(member);

        const req = buildRequest(NextRequest, 'https://maavadao.com/', {
            cookies: { 'auth-token': 'valid-jwt' },
            headers: { 'x-forwarded-host': 'maavadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(307);
        expect(res?.headers.get('location')).toBe('https://agent.maavadao.com/alice');
    });

    test('can still use the marketplace on the main site', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(member);

        const req = buildRequest(NextRequest, 'https://maavadao.com/marketplace', {
            cookies: { 'auth-token': 'valid-jwt' },
            headers: { 'x-forwarded-host': 'maavadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(200);
    });

    test('is not redirected again when already on the member space host', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(member);

        const req = buildRequest(NextRequest, 'https://agent.maavadao.com/', {
            cookies: { 'auth-token': 'valid-jwt' },
            headers: { 'x-forwarded-host': 'agent.maavadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(200);
    });
});

describe('signed in without a workspace', () => {
    test('is redirected away from the login page', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(newUser);

        const req = buildRequest(NextRequest, 'https://maavadao.com/auth/login', {
            cookies: { 'auth-token': 'valid-jwt' },
            headers: { 'x-forwarded-host': 'maavadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(307);
        const location = res?.headers.get('location') || '';
        expect(location).toMatch(/\/$/);
    });

    test('is sent to workspace setup from other pages', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(newUser);

        const req = buildRequest(NextRequest, 'https://maavadao.com/channels', {
            cookies: { 'auth-token': 'valid-jwt' },
            headers: { 'x-forwarded-host': 'maavadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(307);
        expect(res?.headers.get('location')).toContain('step=subdomain');
    });
});

describe('not signed in', () => {
    test('login page is accessible', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(null);

        const req = buildRequest(NextRequest, 'https://maavadao.com/auth/login', {
            headers: { 'x-forwarded-host': 'maavadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(200);
    });

    test('protected route redirects to login', async () => {
        const { mw, mockedAuth, NextRequest } = getModules();
        mockedAuth.validateJWT.mockResolvedValue(null);

        const req = buildRequest(NextRequest, 'https://maavadao.com/settings', {
            headers: { 'x-forwarded-host': 'maavadao.com' },
        });

        const res = await mw(req);
        expect(res?.status).toBe(307);
        const location = res?.headers.get('location') || '';
        expect(location).toContain('/auth/login');
    });
});
