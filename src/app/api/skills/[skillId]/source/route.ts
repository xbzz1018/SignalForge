import { NextResponse } from 'next/server';
import { requireAction } from '@/lib/auth/action';
import { AuthorizationError } from '@/lib/auth/authorization';
import { authErrorResponse } from '@/lib/auth/http';
import { readSkillFile } from '@/lib/quant/skills-admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  try {
    await requireAction({ headers: request.headers, action: 'platform.settings.manage' });
    const { skillId } = await params;
    const filePath = new URL(request.url).searchParams.get('path') ?? 'SKILL.md';
    const data = await readSkillFile(skillId, filePath);
    return NextResponse.json({ success: true, data }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return authErrorResponse(error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '读取 Skill 文件失败。',
    }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
