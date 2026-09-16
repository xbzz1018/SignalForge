import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAction } from '@/lib/auth/action';
import { AuthorizationError } from '@/lib/auth/authorization';
import { authErrorResponse } from '@/lib/auth/http';
import { getRuntimeDegradationConfig } from '@/lib/config/degradation';
import { createServiceToken } from '@/lib/services/tokens';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/utils/api-response';

const tokenInputSchema = z.object({
  provider: z.enum(['github', 'supabase', 'vercel']),
  token: z.string().trim().min(1).max(65_536),
  name: z.string().trim().max(120).optional().default(''),
}).strict();

export async function POST(request: NextRequest) {
  try {
    await requireAction({
      headers: request.headers,
      action: 'platform.tokens.manage',
    });
    if (!getRuntimeDegradationConfig().components.database.enabled) {
      return createErrorResponse(
        'DATABASE_UNAVAILABLE',
        '服务令牌存储暂时不可用，请启动 TimescaleDB 后重试。',
        503,
      );
    }
    const body = tokenInputSchema.parse(await request.json());
    const record = await createServiceToken(body.provider, body.token, body.name);
    return createSuccessResponse(record, 201);
  } catch (error) {
    if (error instanceof AuthorizationError) return authErrorResponse(error);
    return handleApiError(error, 'Tokens API', 'Failed to save token');
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
