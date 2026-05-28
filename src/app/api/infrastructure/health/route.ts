import { execFile } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

const execFileAsync = promisify(execFile);

function maskDatabaseUrl(value: string): string {
  return value.replace(/:\/\/([^:/?#]+):([^@/?#]+)@/, '://$1:***@');
}

async function getDockerComposeStatus() {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['compose', 'ps', 'timescaledb', '--format', 'json'],
      { cwd: process.cwd(), timeout: 3000 }
    );

    const rows = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    const service = rows[0] ?? null;
    return {
      available: true,
      running: service ? String(service.State ?? '').toLowerCase() === 'running' : false,
      service: service
        ? {
            name: String(service.Name ?? ''),
            state: String(service.State ?? ''),
            status: String(service.Status ?? ''),
            image: String(service.Image ?? ''),
          }
        : null,
    };
  } catch (error) {
    return {
      available: false,
      running: false,
      service: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const provider =
    databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')
      ? 'postgresql'
      : 'unsupported';

  const docker = await getDockerComposeStatus();

  try {
    await prisma.project.findFirst({ select: { id: true } });

    const extension =
      provider === 'postgresql'
        ? await prisma.$queryRaw<Array<{ extversion: string }>>`
            SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'
          `
        : [];
    const quantTables =
      provider === 'postgresql'
        ? await prisma.$queryRaw<Array<{ table_name: string }>>`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'quant'
            ORDER BY table_name
          `
        : [];

    return NextResponse.json({
      success: true,
      data: {
        provider,
        databaseUrl: databaseUrl ? maskDatabaseUrl(databaseUrl) : '',
        connected: true,
        timescale: {
          enabled: extension.length > 0,
          version: extension[0]?.extversion ?? null,
        },
        quantSchema: {
          tables: quantTables.map((row) => row.table_name),
        },
        docker,
        commands: {
          start: 'npm run db:up',
          sync: 'npm run prisma:push',
          inspect: 'npm run db:doctor',
          psql: 'npm run db:psql',
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: {
          provider,
          databaseUrl: databaseUrl ? maskDatabaseUrl(databaseUrl) : '',
          connected: false,
          timescale: {
            enabled: false,
            version: null,
          },
          quantSchema: {
            tables: [],
          },
          docker,
          commands: {
            start: 'npm run db:up',
            sync: 'npm run prisma:push',
            inspect: 'npm run db:doctor',
            psql: 'npm run db:psql',
          },
        },
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 }
    );
  }
}
