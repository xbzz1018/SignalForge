import { describe, expect, it } from 'vitest';
import { toolObservationFingerprint } from './progress-observation';

describe('stable progress observation identity', () => {
  it('keeps business identifiers in tool inputs even when transport identifiers are ignored in results', () => {
    const fingerprint = (arguments_: string) => toolObservationFingerprint(
      { id: 'transport', name: 'inspect_run', arguments: arguments_ },
      { result: { ok: true, data: { state: 'ready' } }, terminal: false, durationMs: 0, targetReferences: [] },
    );
    expect(fingerprint('{"runId":"business-a","limit":10}'))
      .toBe(fingerprint('{"limit":10,"runId":"business-a"}'));
    expect(fingerprint('{"runId":"business-a","limit":10}'))
      .not.toBe(fingerprint('{"runId":"business-b","limit":10}'));
  });
  it('ignores transport refreshes and preserves actual observation time and contents', () => {
    const fingerprint = (id: string, fetchedAt: string, asOf: string, price = 10) =>
      toolObservationFingerprint({ id, name: 'market', arguments: '{"symbol":"510300"}' }, {
        result: { ok: true, data: { price, as_of: asOf, fetched_at: fetchedAt } },
        terminal: false, durationMs: 0, targetReferences: [],
      });
    expect(fingerprint('a', '2026-01-02', '2026-01-01')).toBe(fingerprint('b', '2026-01-03', '2026-01-01'));
    expect(fingerprint('a', '2026-01-02', '2026-01-01')).not.toBe(fingerprint('b', '2026-01-03', '2026-01-02'));
    expect(fingerprint('a', '2026-01-02', '2026-01-01')).not.toBe(fingerprint('b', '2026-01-02', '2026-01-01', 11));
  });
});
