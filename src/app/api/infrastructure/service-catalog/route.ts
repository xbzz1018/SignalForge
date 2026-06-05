import { NextResponse } from 'next/server';
import {
  buildServiceDependencyEdges,
  getResolvedServiceCatalog,
  validateServiceCatalog,
} from '@/lib/platform/service-catalog';

export async function GET() {
  const services = getResolvedServiceCatalog();
  const validation = validateServiceCatalog();
  return NextResponse.json(
    {
      success: validation.ok,
      data: {
        version: 1,
        services,
        dependencies: buildServiceDependencyEdges(services),
        validation,
      },
      error: validation.errors[0] ?? null,
    },
    { status: validation.ok ? 200 : 500 }
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
