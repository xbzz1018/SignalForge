export type ClaudeModelId = string;

export interface ClaudeModelDefinition {
  id: ClaudeModelId;
  /** Human friendly display name */
  name: string;
  /** Optional longer description */
  description?: string;
  /** Whether the model can accept images */
  supportsImages?: boolean;
  /** Provider shown in model management surfaces */
  provider?: 'anthropic' | 'minimax' | 'external';
  /** Runtime protocol used by Claude Code */
  runtime?: 'anthropic-compatible';
  /** Whether this model is served by a third-party Anthropic-compatible endpoint */
  external?: boolean;
  /** Acceptable alias strings that should resolve to this model id */
  aliases: string[];
}

export const CLAUDE_MODEL_DEFINITIONS: ClaudeModelDefinition[] = [
  {
    id: 'MiniMax-M2.7',
    name: 'MiniMax M2.7',
    description: 'MiniMax model served through the Anthropic-compatible Claude Code runtime',
    supportsImages: false,
    provider: 'minimax',
    runtime: 'anthropic-compatible',
    external: true,
    aliases: [
      'MiniMax-M2.7',
      'minimax-m2.7',
      'minimax-m2-7',
      'm2.7',
      'm2-7',
    ],
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'The most intelligent model for building agents and coding',
    supportsImages: true,
    provider: 'anthropic',
    runtime: 'anthropic-compatible',
    aliases: [
      'claude-opus-4-6',
      'claude-opus-4.6',
      'claude-opus-4',
      'claude-opus',
      'opus-4-6',
      'opus-4.6',
      'opus-4',
      'opus',
      // Legacy aliases
      'claude-opus-4-5-20251101',
      'claude-opus-4-5',
      'claude-opus-4.5',
      'claude-opus-4-1-20250805',
      'claude-opus-4-1',
      'claude-opus-4.1',
      'claude-3-opus',
      'claude-3-opus-20240229',
      'claude-3-opus-latest',
    ],
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'The best combination of speed and intelligence',
    supportsImages: true,
    provider: 'anthropic',
    runtime: 'anthropic-compatible',
    aliases: [
      'claude-sonnet-4-6',
      'claude-sonnet-4.6',
      'claude-sonnet-4',
      'claude-sonnet',
      'sonnet-4-6',
      'sonnet-4.6',
      'sonnet-4',
      'sonnet',
      // Legacy aliases
      'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-5',
      'claude-sonnet-4.5',
      'claude-3.5-sonnet',
      'claude-3-5-sonnet',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-latest',
    ],
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'The fastest model with near-frontier intelligence',
    supportsImages: true,
    provider: 'anthropic',
    runtime: 'anthropic-compatible',
    aliases: [
      'claude-haiku-4-5-20251001',
      'claude-haiku-4-5',
      'claude-haiku-4.5',
      'claude-haiku-4',
      'claude-haiku',
      'haiku-4-5-20251001',
      'haiku-4-5',
      'haiku-4.5',
      'haiku-4',
      'haiku',
      'claude-3-haiku',
      'claude-3-haiku-20240307',
      'claude-3-haiku-latest',
      'claude-haiku-3.5',
    ],
  },
];

export const CLAUDE_DEFAULT_MODEL: ClaudeModelId = 'MiniMax-M2.7';

const CLAUDE_MODEL_ALIAS_MAP: Record<string, ClaudeModelId> = CLAUDE_MODEL_DEFINITIONS.reduce(
  (map, definition) => {
    definition.aliases.forEach(alias => {
      const key = alias.trim().toLowerCase().replace(/[\s_]+/g, '-');
      map[key] = definition.id;
    });
    map[definition.id.toLowerCase()] = definition.id;
    return map;
  },
  {} as Record<string, ClaudeModelId>
);

export function normalizeClaudeModelId(model?: string | null): ClaudeModelId {
  if (!model) return CLAUDE_DEFAULT_MODEL;
  const trimmed = model.trim();
  if (!trimmed) return CLAUDE_DEFAULT_MODEL;
  const normalized = trimmed.toLowerCase().replace(/[\s_]+/g, '-');
  return CLAUDE_MODEL_ALIAS_MAP[normalized] ?? trimmed;
}

export function getClaudeModelDefinition(id: string): ClaudeModelDefinition | undefined {
  return (
    CLAUDE_MODEL_DEFINITIONS.find(def => def.id === id) ??
    CLAUDE_MODEL_DEFINITIONS.find(def =>
      def.aliases.some(alias => alias.toLowerCase() === id.toLowerCase())
    )
  );
}

export function getClaudeModelDisplayName(id: string): string {
  return getClaudeModelDefinition(id)?.name ?? id;
}
