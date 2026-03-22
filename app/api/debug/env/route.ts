import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET() {
  return NextResponse.json({
    env_DATABASE_URL: process.env.DATABASE_URL,
    config_databaseUrl: config.databaseUrl,
  });
}
