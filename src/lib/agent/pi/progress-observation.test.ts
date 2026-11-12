import { describe, expect, it } from 'vitest';
import { toolObservationFingerprint } from './progress-observation';

describe('stable progress observation identity', () => {
  const fingerprint = (data: unknown, arguments_ = '{}') => toolObservationFingerprint(
    { id: 'call', name: 'inspect', arguments: arguments_ },
    { result: { ok: true, data }, terminal: false, durationMs: 0, targetReferences: [] },
  );
  it('treats shared references as equivalent to their serialized values', () => {
    const shared = { price: 10 };
    expect(fingerprint({ left: shared, right: shared })).toBe(fingerprint({ left: { price: 10 }, right: { price: 10 } }));
    expect(fingerprint({ left: shared, right: shared })).not.toBe(fingerprint({ left: shared, right: '[Circular]' }));
  });
  it('handles actual cycles and preserves date values', () => {
    const cyclic: Record<string, unknown> = { value: 1 };
    cyclic.self = cyclic;
    expect(() => fingerprint(cyclic)).not.toThrow();
    expect(fingerprint({ date: new Date('2025-01-01') })).toBe(fingerprint({ date: '2025-01-01T00:00:00.000Z' }));
  });
  it('can observe malformed arguments without crashing the agent loop', () => {
    expect(() => fingerprint({ error: 'invalid' }, '{broken')).not.toThrow();
    expect(fingerprint({}, '{broken')).not.toBe(fingerprint({}, JSON.stringify({ invalidJson: '{broken' })));
  });
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
