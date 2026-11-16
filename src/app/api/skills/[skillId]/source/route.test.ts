import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAction: vi.fn(), readSkillFile: vi.fn() }));
vi.mock('@/lib/auth/action', () => ({ requireAction: mocks.requireAction }));
vi.mock('@/lib/quant/skills-admin', () => ({ readSkillFile: mocks.readSkillFile }));

import { AuthorizationError } from '@/lib/auth/authorization';
import { GET } from './route';

describe('Skill source read endpoint', () => {
  const params = Promise.resolve({ skillId: 'market-analysis' });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAction.mockResolvedValue({ session: { user: { id: 'admin' } } });
    mocks.readSkillFile.mockResolvedValue({ skillId: 'market-analysis', filePath: 'SKILL.md', content: '# Skill' });
  });

  it('allows an authorized administrator to read without a host mutation token', async () => {
    const request = new Request('http://localhost/api/skills/market-analysis/source');
    const response = await GET(request, { params });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.requireAction).toHaveBeenCalledWith({ headers: request.headers, action: 'platform.settings.manage' });
    expect(mocks.readSkillFile).toHaveBeenCalledWith('market-analysis', 'SKILL.md');
    await expect(response.json()).resolves.toMatchObject({ success: true, data: { content: '# Skill' } });
  });

  it('keeps source access behind authorization before reading any file', async () => {
    mocks.requireAction.mockRejectedValue(new AuthorizationError('CAPABILITY_DENIED', 403, 'Forbidden'));
    const response = await GET(new Request('http://localhost/api/skills/market-analysis/source'), { params });
    expect(response.status).toBe(403);
    expect(mocks.readSkillFile).not.toHaveBeenCalled();
  });

  it('passes the selected file through the existing safe Skill path resolver', async () => {
    const request = new Request('http://localhost/api/skills/market-analysis/source?path=references%2Fdata.md');
    expect((await GET(request, { params })).status).toBe(200);
    expect(mocks.readSkillFile).toHaveBeenCalledWith('market-analysis', 'references/data.md');
    mocks.readSkillFile.mockRejectedValue(new Error('Path traversal is not allowed'));
    const invalid = await GET(new Request('http://localhost/api/skills/market-analysis/source?path=..%2F.env'), { params });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ success: false });
  });
});
