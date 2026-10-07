import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_CLOUD_MODE: process.env.NEXT_PUBLIC_CLOUD_MODE ?? '(not set)',
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? '(not set)',
    NODE_ENV: process.env.NODE_ENV ?? '(not set)',
    NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL ?? '(not set)',
    JWT_SECRET_SET: !!process.env.JWT_SECRET,
    timestamp: new Date().toISOString(),
  });
}
