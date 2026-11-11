import { createHash } from 'node:crypto';
import type { PiAgentToolCall, PiAgentToolContextReceipt } from '../types';
import type { PiAgentToolExecution } from '../core/tool-executor';
import { createProgressOracleState } from '../core/progress-oracle';

// Transport refreshes do not establish a new market observation. Preserve as_of/quote_time.
const TRANSIENT_KEYS = new Set([
  'operationId', 'toolCallId', 'runId', 'durationMs', 'duration_ms',
  'fetched_at', 'fetchedAt', 'cache_status', 'cacheStatus', 'cache_ttl_seconds',
]);

function stableJson(value: unknown, ignoreTransient = true): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (key, candidate: unknown) => {
    if (ignoreTransient && TRANSIENT_KEYS.has(key)) return undefined;
    if (typeof candidate === 'bigint') return candidate.toString();
    if (candidate && typeof candidate === 'object') {
      if (seen.has(candidate)) return '[Circular]';
      seen.add(candidate);
      if (!Array.isArray(candidate)) {
        return Object.fromEntries(Object.entries(candidate).sort(([a], [b]) => a.localeCompare(b)));
      }
    }
    return candidate;
  }) ?? 'null';
}

export function toolObservationFingerprint(call: PiAgentToolCall, execution: PiAgentToolExecution): string {
  const receipt = execution.contextReceipt;
  const observation = execution.result.ok
    ? receipt?.artifactSha256
      ? { artifactSha256: receipt.artifactSha256, targets: receipt.targetReferences }
      : { data: execution.result.data }
    : { error: execution.result.error };
  return createHash('sha256').update(call.name).update('\0')
    .update(stableJson(JSON.parse(call.arguments), false)).update('\0')
    .update(stableJson(observation)).digest('hex');
}

export function initialProgressState(workspaceFingerprint: string) {
  return { ...createProgressOracleState(), lastWorkspaceFingerprint: workspaceFingerprint,
    seenWorkspaceFingerprints: [workspaceFingerprint] };
}

export function updateWorkspaceReceipt(
  artifacts: Map<string, string>, receipt: PiAgentToolContextReceipt | undefined,
): string | undefined {
  if (!receipt?.artifactSha256 || !receipt.targetReferences.length) return undefined;
  for (const target of receipt.targetReferences) artifacts.set(target, receipt.artifactSha256);
  return createHash('sha256').update(stableJson(Object.fromEntries(artifacts))).digest('hex');
}
