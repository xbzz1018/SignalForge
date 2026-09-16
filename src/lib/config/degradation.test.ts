import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRuntimeDegradationConfig } from './degradation';

describe('runtime degradation configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables database access when offline mode is selected', () => {
    vi.stubEnv('QUANTPILOT_DEGRADATION_MODE', 'offline');
    vi.stubEnv('QUANTPILOT_DATABASE_ENABLED', '1');

    const config = getRuntimeDegradationConfig();

    expect(config.mode).toBe('offline');
    expect(config.components.database).toEqual({ enabled: false, required: false });
    expect(config.components.marketApi.enabled).toBe(false);
  });

  it('keeps an explicitly disabled database disabled outside offline mode', () => {
    vi.stubEnv('QUANTPILOT_DEGRADATION_MODE', 'auto');
    vi.stubEnv('QUANTPILOT_DATABASE_ENABLED', '0');

    expect(getRuntimeDegradationConfig().components.database).toEqual({
      enabled: false,
      required: true,
    });
  });
});
