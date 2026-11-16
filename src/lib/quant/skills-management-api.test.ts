import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSkillFile } from './skills-management-api';

describe('Skill source browser requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads through GET without entering the privileged mutation API', async () => {
    const source = { skillId: 'market-analysis', filePath: 'references/data & risk.md', content: '# data' };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true, data: source }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(readSkillFile(source.skillId, source.filePath)).resolves.toEqual(source);
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.pathname).toBe('/api/skills/market-analysis/source');
    expect(parsed.searchParams.get('path')).toBe(source.filePath);
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('surfaces authorization errors to the source panel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: false, error: 'Forbidden' }, { status: 403 })));
    await expect(readSkillFile('market-analysis', 'SKILL.md')).rejects.toThrow('Forbidden');
  });
});
