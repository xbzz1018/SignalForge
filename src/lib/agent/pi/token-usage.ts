import type { Usage } from '@earendil-works/pi-ai';
import type { PiAgentTokenUsage } from '../types';

/** Conservative fallback for completed responses without a token receipt; never a bill. */
export function estimateUnreportedUsage(
  inputTokens: number,
  text: string,
  reasoning: string,
  toolCalls: string
): PiAgentTokenUsage {
  const reasoningTokens = Buffer.byteLength(reasoning, 'utf8');
  const outputTokens = Buffer.byteLength(text, 'utf8') + reasoningTokens + Buffer.byteLength(toolCalls, 'utf8');
  return {
    inputTokens: tokenCount(inputTokens, 'Estimated input usage'),
    outputTokens,
    totalTokens: tokenCount(inputTokens + outputTokens, 'Estimated total usage'),
    cachedInputTokens: 0,
    cacheMissInputTokens: inputTokens,
    ...(reasoningTokens ? { reasoningTokens } : {}),
    usageSource: 'estimated',
  };
}

export const EMPTY_USAGE: PiAgentTokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cachedInputTokens: 0,
  cacheMissInputTokens: 0,
};

/** SDK cost fields are placeholders; SignalForge has no provider billing receipt here. */
export const EMPTY_PI_USAGE: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
};

function combinedSource(left: PiAgentTokenUsage, right: PiAgentTokenUsage): PiAgentTokenUsage['usageSource'] {
  if (left.usageSource === 'partial' || right.usageSource === 'partial') return 'partial';
  if (left.totalTokens === 0) return right.usageSource;
  if (right.totalTokens === 0) return left.usageSource;
  if (left.usageSource === right.usageSource) return left.usageSource;
  if ([left.usageSource, right.usageSource].some((source) => source === 'estimated' || source === 'mixed'))
    return 'mixed';
  return 'cache_estimated';
}

export function addUsage(left: PiAgentTokenUsage, right: PiAgentTokenUsage): PiAgentTokenUsage {
  const cachedInputTokens = (left.cachedInputTokens ?? 0) + (right.cachedInputTokens ?? 0);
  const cacheMissInputTokens = (left.cacheMissInputTokens ?? 0) + (right.cacheMissInputTokens ?? 0);
  const reasoningTokens = (left.reasoningTokens ?? 0) + (right.reasoningTokens ?? 0);
  const usageSource = combinedSource(left, right);
  return {
    inputTokens: tokenCount(left.inputTokens + right.inputTokens, 'Cumulative input usage'),
    outputTokens: tokenCount(left.outputTokens + right.outputTokens, 'Cumulative output usage'),
    totalTokens: tokenCount(left.totalTokens + right.totalTokens, 'Cumulative total usage'),
    cachedInputTokens,
    cacheMissInputTokens,
    ...(left.reasoningTokens === undefined && right.reasoningTokens === undefined ? {} : { reasoningTokens }),
    ...(usageSource ? { usageSource } : {}),
  };
}

export function tokenCount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

/**
 * PI reports non-cached input, cache reads and cache writes separately.
 * SignalForge's historical inputTokens is the full provider input.
 */
type HostUsage = Usage & Pick<PiAgentTokenUsage, 'usageSource'>;

export function usageFromPi(usage: HostUsage): PiAgentTokenUsage {
  const input = tokenCount(usage.input, 'PI input usage');
  const output = tokenCount(usage.output, 'PI output usage');
  const cacheRead = tokenCount(usage.cacheRead, 'PI cache-read usage');
  const cacheWrite = tokenCount(usage.cacheWrite, 'PI cache-write usage');
  const inputTokens = input + cacheRead + cacheWrite;
  const totalTokens = inputTokens + output;
  if (tokenCount(usage.totalTokens, 'PI total usage') !== totalTokens) {
    throw new Error('PI total usage does not match its token breakdown.');
  }
  if (usage.reasoning !== undefined && tokenCount(usage.reasoning, 'PI reasoning usage') > output) {
    throw new Error('PI reasoning usage cannot exceed output usage.');
  }
  return {
    inputTokens,
    outputTokens: output,
    totalTokens,
    cachedInputTokens: cacheRead,
    cacheMissInputTokens: input + cacheWrite,
    ...(usage.usageSource ? { usageSource: usage.usageSource } : {}),
    ...(usage.reasoning === undefined ? {} : { reasoningTokens: usage.reasoning }),
  };
}

export function usageToPi(usage: PiAgentTokenUsage): HostUsage {
  const fullInput = tokenCount(usage.inputTokens, 'SignalForge input usage');
  const output = tokenCount(usage.outputTokens, 'SignalForge output usage');
  if (tokenCount(usage.totalTokens, 'SignalForge total usage') !== fullInput + output) {
    throw new Error('SignalForge total usage does not match input plus output usage.');
  }
  let cacheRead =
    usage.cachedInputTokens === undefined
      ? undefined
      : tokenCount(usage.cachedInputTokens, 'SignalForge cached-input usage');
  let cacheMiss =
    usage.cacheMissInputTokens === undefined
      ? undefined
      : tokenCount(usage.cacheMissInputTokens, 'SignalForge cache-miss usage');
  if (cacheRead === undefined && cacheMiss === undefined) {
    cacheRead = 0;
    cacheMiss = fullInput;
  } else if (cacheRead === undefined) {
    if (cacheMiss! > fullInput) {
      throw new Error('SignalForge cache-miss usage cannot exceed full input usage.');
    }
    cacheRead = fullInput - cacheMiss!;
  } else if (cacheMiss === undefined) {
    if (cacheRead > fullInput) {
      throw new Error('SignalForge cached-input usage cannot exceed full input usage.');
    }
    cacheMiss = fullInput - cacheRead;
  }
  if (cacheRead === undefined || cacheMiss === undefined) {
    throw new Error('SignalForge usage normalization failed.');
  }
  if (cacheRead + cacheMiss !== fullInput) {
    throw new Error('SignalForge cached and cache-miss usage must equal full input usage.');
  }
  if (usage.reasoningTokens !== undefined && tokenCount(usage.reasoningTokens, 'SignalForge reasoning usage') > output) {
    throw new Error('SignalForge reasoning usage cannot exceed output usage.');
  }
  const totalTokens = fullInput + output;
  return {
    input: cacheMiss,
    output,
    cacheRead,
    cacheWrite: 0,
    ...(usage.reasoningTokens === undefined ? {} : { reasoning: usage.reasoningTokens }),
    totalTokens,
    ...(usage.usageSource ? { usageSource: usage.usageSource } : {}),
    cost: { ...EMPTY_PI_USAGE.cost },
  };
}
