// ── Model definitions (merged from individual CLI model files) ───────────────

// ── Claude ──────────────────────────────────────────────────────────────────
export type ClaudeModelId = string;

export interface ClaudeModelDefinition {
  id: ClaudeModelId;
  name: string;
  description?: string;
  supportsImages?: boolean;
  provider?: "anthropic" | "minimax" | "external";
  runtime?: "anthropic-compatible";
  external?: boolean;
  aliases: string[];
}

export const CLAUDE_MODEL_DEFINITIONS: ClaudeModelDefinition[] = [
  { id: "mimo-v2.5-pro", name: "Mimo V2.5 Pro", description: "Mimo model served through the Anthropic-compatible Claude Code runtime", supportsImages: false, provider: "external", runtime: "anthropic-compatible", external: true, aliases: ["mimo-v2.5-pro", "mimo-v25-pro", "mimo-2.5-pro", "mimo 2.5 pro", "mimo"] },
  { id: "MiniMax-M2.7", name: "MiniMax M2.7", description: "MiniMax model served through the Anthropic-compatible Claude Code runtime", supportsImages: false, provider: "minimax", runtime: "anthropic-compatible", external: true, aliases: ["MiniMax-M2.7", "minimax-m2.7", "minimax-m2-7", "m2.7", "m2-7"] },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", description: "Claude Code fallback model exposed by the current Anthropic-compatible gateway", supportsImages: false, provider: "external", runtime: "anthropic-compatible", external: true, aliases: ["deepseek-v4-pro", "deepseek-v4", "deepseek 4 pro", "deepseek-pro"] },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", description: "Fast Claude Code fallback model exposed by the current Anthropic-compatible gateway", supportsImages: false, provider: "external", runtime: "anthropic-compatible", external: true, aliases: ["deepseek-v4-flash", "deepseek-flash", "deepseek 4 flash"] },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", description: "The most intelligent model for building agents and coding", supportsImages: true, provider: "anthropic", runtime: "anthropic-compatible", aliases: ["claude-opus-4-6", "claude-opus-4.6", "claude-opus-4", "claude-opus", "opus-4-6", "opus-4.6", "opus-4", "opus", "claude-opus-4-5-20251101", "claude-opus-4-5", "claude-opus-4.5", "claude-opus-4-1-20250805", "claude-opus-4-1", "claude-opus-4.1", "claude-3-opus", "claude-3-opus-20240229", "claude-3-opus-latest"] },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "The best combination of speed and intelligence", supportsImages: true, provider: "anthropic", runtime: "anthropic-compatible", aliases: ["claude-sonnet-4-6", "claude-sonnet-4.6", "claude-sonnet-4", "claude-sonnet", "sonnet-4-6", "sonnet-4.6", "sonnet-4", "sonnet", "claude-sonnet-4-5-20250929", "claude-sonnet-4-5", "claude-sonnet-4.5", "claude-3.5-sonnet", "claude-3-5-sonnet", "claude-3-5-sonnet-20241022", "claude-3-5-sonnet-latest"] },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", description: "The fastest model with near-frontier intelligence", supportsImages: true, provider: "anthropic", runtime: "anthropic-compatible", aliases: ["claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-haiku-4.5", "claude-haiku-4", "claude-haiku", "haiku-4-5-20251001", "haiku-4-5", "haiku-4.5", "haiku-4", "haiku", "claude-3-haiku", "claude-3-haiku-20240307", "claude-3-haiku-latest", "claude-haiku-3.5"] },
];
export const CLAUDE_DEFAULT_MODEL: ClaudeModelId = "mimo-v2.5-pro";

const CLAUDE_MODEL_ALIAS_MAP: Record<string, ClaudeModelId> = CLAUDE_MODEL_DEFINITIONS.reduce((map, def) => {
  def.aliases.forEach((a) => { map[a.trim().toLowerCase().replace(/[\s_]+/g, "-")] = def.id; });
  map[def.id.toLowerCase()] = def.id;
  return map;
}, {} as Record<string, ClaudeModelId>);

export function normalizeClaudeModelId(model?: string | null): ClaudeModelId {
  if (!model) return CLAUDE_DEFAULT_MODEL;
  const trimmed = model.trim();
  if (!trimmed) return CLAUDE_DEFAULT_MODEL;
  return CLAUDE_MODEL_ALIAS_MAP[trimmed.toLowerCase().replace(/[\s_]+/g, "-")] ?? trimmed;
}
export function getClaudeModelDefinition(id: string): ClaudeModelDefinition | undefined {
  return CLAUDE_MODEL_DEFINITIONS.find((d) => d.id === id) ?? CLAUDE_MODEL_DEFINITIONS.find((d) => d.aliases.some((a) => a.toLowerCase() === id.toLowerCase()));
}
export function getClaudeModelDisplayName(id: string): string {
  return getClaudeModelDefinition(id)?.name ?? id;
}

// ── Codex ───────────────────────────────────────────────────────────────────
export interface CodexModelDefinition {
  id: string; name: string; description?: string; supportsImages?: boolean;
  provider?: string; runtime?: string; external?: boolean;
}
export const CODEX_DEFAULT_MODEL = "gpt-5.5";
export const CODEX_MODEL_DEFINITIONS: CodexModelDefinition[] = [
  { id: "gpt-5.5", name: "GPT-5.5", description: "Third-party OpenAI-compatible GPT model for Codex CLI", supportsImages: true, provider: "OpenAI Compatible", runtime: "Codex CLI", external: true },
];

const CODEX_ALIAS_MAP: Record<string, string> = {
  gpt55: "gpt-5.5", gpt_5_5: "gpt-5.5", "gpt-5-5": "gpt-5.5", "gpt5.5": "gpt-5.5",
  gpt5: CODEX_DEFAULT_MODEL, gpt_5: CODEX_DEFAULT_MODEL, "gpt-5": CODEX_DEFAULT_MODEL, "gpt-5.0": CODEX_DEFAULT_MODEL,
  "gpt-4o": CODEX_DEFAULT_MODEL, gpt4o: CODEX_DEFAULT_MODEL, "gpt-4o-mini": CODEX_DEFAULT_MODEL,
  "gpt-4o-mini-high": CODEX_DEFAULT_MODEL, "gpt-4o-mini-low": CODEX_DEFAULT_MODEL,
  "o1-preview": CODEX_DEFAULT_MODEL, "o1-mini": CODEX_DEFAULT_MODEL,
  "claude-3.5-sonnet": CODEX_DEFAULT_MODEL, "claude-sonnet-3.5": CODEX_DEFAULT_MODEL,
  "claude35-sonnet": CODEX_DEFAULT_MODEL, "claude-3-haiku": CODEX_DEFAULT_MODEL,
};
const CODEX_KNOWN_IDS = new Set(CODEX_MODEL_DEFINITIONS.map((m) => m.id));

export function normalizeCodexModelId(model?: string | null): string {
  if (!model || typeof model !== "string") return CODEX_DEFAULT_MODEL;
  const trimmed = model.trim();
  if (!trimmed) return CODEX_DEFAULT_MODEL;
  const lower = trimmed.toLowerCase();
  if (CODEX_ALIAS_MAP[lower]) return CODEX_ALIAS_MAP[lower];
  if (CODEX_KNOWN_IDS.has(lower)) return lower;
  if (CODEX_KNOWN_IDS.has(trimmed)) return trimmed;
  return CODEX_DEFAULT_MODEL;
}
export function getCodexModelDisplayName(id?: string | null): string {
  if (!id) return CODEX_MODEL_DEFINITIONS.find((m) => m.id === CODEX_DEFAULT_MODEL)?.name ?? CODEX_DEFAULT_MODEL;
  const n = normalizeCodexModelId(id);
  return CODEX_MODEL_DEFINITIONS.find((m) => m.id === n)?.name ?? n;
}

// ── Cursor ──────────────────────────────────────────────────────────────────
export interface CursorModelDefinition {
  id: string; name: string; description?: string; supportsImages?: boolean;
}
export const CURSOR_DEFAULT_MODEL = "gpt-5";
export const CURSOR_MODEL_DEFINITIONS: CursorModelDefinition[] = [
  { id: "gpt-5", name: "GPT-5", description: "Cursor Agent default multi-model router (auto-selects best model)" },
  { id: "sonnet-4", name: "Claude Sonnet 4", description: "Anthropic Claude Sonnet via Cursor Agent router" },
  { id: "sonnet-4-thinking", name: "Claude Sonnet 4 (Thinking)", description: "High-depth Claude Sonnet reasoning mode" },
];

const CURSOR_MODEL_ALIASES: Record<string, string> = {
  gpt5: "gpt-5", "gpt-5.0": "gpt-5", sonnet4: "sonnet-4", "sonnet-4.5": "sonnet-4", "sonnet-45": "sonnet-4",
  "claude-sonnet-4.5": "sonnet-4", "claude-sonnet-45": "sonnet-4", "claude-sonnet-4_5": "sonnet-4",
  "claude-sonnet-4": "sonnet-4", "sonnet-4.0-thinking": "sonnet-4-thinking", "claude-sonnet-4-thinking": "sonnet-4-thinking",
  "opus-4.6": "sonnet-4", "opus-4.1": "sonnet-4", "claude-opus-4.6": "sonnet-4", "claude-opus-4.1": "sonnet-4",
  "claude-opus-46": "sonnet-4", "claude-opus-41": "sonnet-4", "claude-opus-4_6": "sonnet-4", "claude-opus-4_1": "sonnet-4",
};
const KNOWN_CURSOR_MODEL_IDS = new Set(CURSOR_MODEL_DEFINITIONS.map((m) => m.id));
const CURSOR_CLI_MODEL_IDS: Record<string, string> = { "gpt-5": "gpt-5", "sonnet-4": "sonnet-4", "sonnet-4-thinking": "sonnet-4-thinking" };

export function normalizeCursorModelId(model?: string | null): string {
  if (!model || typeof model !== "string") return CURSOR_DEFAULT_MODEL;
  const trimmed = model.trim();
  if (!trimmed) return CURSOR_DEFAULT_MODEL;
  const lowered = trimmed.toLowerCase();
  if (CURSOR_MODEL_ALIASES[lowered]) return CURSOR_MODEL_ALIASES[lowered];
  if (KNOWN_CURSOR_MODEL_IDS.has(lowered)) return lowered;
  if (KNOWN_CURSOR_MODEL_IDS.has(trimmed)) return trimmed;
  return CURSOR_DEFAULT_MODEL;
}
export function getCursorModelDisplayName(id?: string | null): string {
  if (!id) return CURSOR_MODEL_DEFINITIONS.find((m) => m.id === CURSOR_DEFAULT_MODEL)?.name ?? CURSOR_DEFAULT_MODEL;
  const n = normalizeCursorModelId(id);
  return CURSOR_MODEL_DEFINITIONS.find((m) => m.id === n)?.name ?? n;
}
export function resolveCursorCliModelId(modelId?: string | null): string {
  const n = normalizeCursorModelId(modelId);
  return CURSOR_CLI_MODEL_IDS[n] ?? n;
}

// ── Qwen ────────────────────────────────────────────────────────────────────
export type QwenModelId = "qwen3-coder-plus" | "qwen3-coder-pro" | "qwen3-coder";

export interface QwenModelDefinition {
  id: QwenModelId; name: string; description?: string; supportsImages?: boolean; aliases: string[];
}
export const QWEN_MODEL_DEFINITIONS: QwenModelDefinition[] = [
  { id: "qwen3-coder-plus", name: "Qwen3 Coder Plus", description: "Balanced 32k context model optimised for coding tasks", aliases: ["qwen3-coder-plus", "qwen3-coder+", "qwen3-plus", "qwen3 coder plus", "qwen-coder-plus", "qwen-coder+", "qwen-plus", "qwen coder plus"] },
  { id: "qwen3-coder-pro", name: "Qwen3 Coder Pro", description: "Larger 128k context model with stronger reasoning", aliases: ["qwen3-coder-pro", "qwen3-pro", "qwen3 coder pro", "qwen-coder-pro", "qwen-pro", "qwen coder pro"] },
  { id: "qwen3-coder", name: "Qwen3 Coder", description: "Default quick model for fast iteration", aliases: ["qwen3-coder", "qwen3", "qwen coder", "qwen-coder", "qwen"] },
];
export const QWEN_DEFAULT_MODEL: QwenModelId = "qwen3-coder-plus";

const QWEN_MODEL_ALIAS_MAP: Record<string, QwenModelId> = QWEN_MODEL_DEFINITIONS.reduce((map, def) => {
  def.aliases.forEach((a) => { map[a.trim().toLowerCase().replace(/[\s_]+/g, "-")] = def.id; });
  map[def.id.toLowerCase()] = def.id;
  return map;
}, {} as Record<string, QwenModelId>);

export function normalizeQwenModelId(model?: string | null): QwenModelId {
  if (!model) return QWEN_DEFAULT_MODEL;
  return QWEN_MODEL_ALIAS_MAP[model.trim().toLowerCase().replace(/[\s_]+/g, "-")] ?? QWEN_DEFAULT_MODEL;
}
export function getQwenModelDefinition(id: string): QwenModelDefinition | undefined {
  return QWEN_MODEL_DEFINITIONS.find((d) => d.id === id) ?? QWEN_MODEL_DEFINITIONS.find((d) => d.aliases.some((a) => a.toLowerCase() === id.toLowerCase()));
}
export function getQwenModelDisplayName(id?: string | null): string {
  if (!id) return getQwenModelDefinition(QWEN_DEFAULT_MODEL)?.name ?? QWEN_DEFAULT_MODEL;
  return getQwenModelDefinition(normalizeQwenModelId(id))?.name ?? normalizeQwenModelId(id);
}

// ── GLM ─────────────────────────────────────────────────────────────────────
export type GLMModelId = "glm-4.6";

export interface GLMModelDefinition {
  id: GLMModelId; name: string; description?: string; supportsImages?: boolean; aliases: string[];
}
export const GLM_MODEL_DEFINITIONS: GLMModelDefinition[] = [
  { id: "glm-4.6", name: "GLM 4.6", description: "Zhipu GLM 4.6 with Claude Code compatible agent runtime", supportsImages: false, aliases: ["glm46", "glm-46", "glm_46", "glm 4.6", "glm-4_6", "glm4.6", "glm4", "glm", "glm-latest"] },
];
export const GLM_DEFAULT_MODEL: GLMModelId = "glm-4.6";

const GLM_MODEL_ALIAS_MAP: Record<string, GLMModelId> = GLM_MODEL_DEFINITIONS.reduce((acc, def) => {
  acc[def.id.toLowerCase()] = def.id;
  for (const a of def.aliases) acc[a.toLowerCase()] = def.id;
  return acc;
}, {} as Record<string, GLMModelId>);

export function normalizeGLMModelId(model?: string | null): GLMModelId {
  if (!model) return GLM_DEFAULT_MODEL;
  const n = model.trim().toLowerCase();
  return n ? GLM_MODEL_ALIAS_MAP[n] ?? GLM_DEFAULT_MODEL : GLM_DEFAULT_MODEL;
}
export function getGLMModelDefinition(id: string): GLMModelDefinition | undefined {
  return GLM_MODEL_DEFINITIONS.find((d) => d.id === id) ?? GLM_MODEL_DEFINITIONS.find((d) => d.aliases.some((a) => a.toLowerCase() === id.toLowerCase()));
}
export function getGLMModelDisplayName(id?: string | null): string {
  if (!id) return getGLMModelDefinition(GLM_DEFAULT_MODEL)?.name ?? GLM_DEFAULT_MODEL;
  return getGLMModelDefinition(normalizeGLMModelId(id))?.name ?? normalizeGLMModelId(id);
}

// ── CLI aggregator ──────────────────────────────────────────────────────────
type CLIKey = "claude" | "codex" | "cursor" | "gemini" | "qwen" | "glm";

type ModelDefinition = {
  id: string; name: string; description?: string; supportsImages?: boolean;
  provider?: string; runtime?: string; external?: boolean;
};

const DEFAULT_MODELS: Record<CLIKey, string> = {
  claude: CLAUDE_DEFAULT_MODEL, codex: CODEX_DEFAULT_MODEL, cursor: CURSOR_DEFAULT_MODEL,
  gemini: "gemini-2.5-pro", qwen: QWEN_DEFAULT_MODEL, glm: GLM_DEFAULT_MODEL,
};

const MODEL_DEFINITIONS: Record<CLIKey, ModelDefinition[]> = {
  claude: CLAUDE_MODEL_DEFINITIONS, codex: CODEX_MODEL_DEFINITIONS, cursor: CURSOR_MODEL_DEFINITIONS,
  gemini: [{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" }, { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }],
  qwen: QWEN_MODEL_DEFINITIONS, glm: GLM_MODEL_DEFINITIONS,
};

export function getDefaultModelForCli(cli: string | null | undefined): string {
  if (!cli) return CLAUDE_DEFAULT_MODEL;
  return DEFAULT_MODELS[cli.toLowerCase() as CLIKey] ?? CLAUDE_DEFAULT_MODEL;
}

export function normalizeModelId(cli: string | null | undefined, model?: string | null): string {
  if (!cli) return normalizeClaudeModelId(model);
  switch (cli.toLowerCase()) {
    case "codex": return normalizeCodexModelId(model);
    case "cursor": return normalizeCursorModelId(model);
    case "qwen": return normalizeQwenModelId(model);
    case "glm": return normalizeGLMModelId(model);
    default: return normalizeClaudeModelId(model);
  }
}

export function getModelDisplayName(cli: string | null | undefined, modelId?: string | null): string {
  if (!cli) return getClaudeModelDisplayName(normalizeClaudeModelId(modelId));
  switch (cli.toLowerCase()) {
    case "codex": return getCodexModelDisplayName(modelId);
    case "cursor": return getCursorModelDisplayName(modelId);
    case "qwen": return getQwenModelDisplayName(modelId);
    case "glm": return getGLMModelDisplayName(modelId);
    default: return getClaudeModelDisplayName(normalizeClaudeModelId(modelId));
  }
}

export function getModelDefinitionsForCli(cli: string | null | undefined): ModelDefinition[] {
  if (!cli) return MODEL_DEFINITIONS.claude;
  return MODEL_DEFINITIONS[cli.toLowerCase() as CLIKey] ?? MODEL_DEFINITIONS.claude;
}
