export const DEEPSEEK_MODEL_ID = 'deepseek-v4-flash' as const;
export const DEEPSEEK_OFFICIAL_BASE_URL = 'https://api.deepseek.com' as const;
export const MODELPORT_DEEPSEEK_MODEL_ID = 'deepseek:deepseek-v4-flash' as const;
export const LOCAL_QWEN_MODEL_ID = 'local_qwen:qwen3.5-9b-q5km' as const;
export const LOCAL_OPENAI_BASE_URL = 'http://127.0.0.1:38082/v1' as const;

export type PiAgentModelId =
  | typeof DEEPSEEK_MODEL_ID
  | typeof MODELPORT_DEEPSEEK_MODEL_ID
  | typeof LOCAL_QWEN_MODEL_ID;

export interface PiAgentModelDefinition {
  id: PiAgentModelId;
  name: string;
  description: string;
  supportsImages: boolean;
  provider: 'deepseek' | 'openai';
  runtime: 'deepseek-official' | 'modelport';
  external: false;
  aliases: string[];
}

export const PI_AGENT_MODEL_DEFINITIONS: PiAgentModelDefinition[] = [
  {
    id: LOCAL_QWEN_MODEL_ID,
    name: 'Qwen 3.5 9B · 本地量化',
    description: '本机 OpenAI-compatible 接口；当前设备的默认量化模型',
    supportsImages: false,
    provider: 'openai',
    runtime: 'modelport',
    external: false,
    aliases: [
      LOCAL_QWEN_MODEL_ID,
      'qwen3.5-9b-q5km',
      'qwen 3.5 9b',
      'local qwen',
    ],
  },
  {
    id: MODELPORT_DEEPSEEK_MODEL_ID,
    name: 'DeepSeek V4 Flash · ModelPort',
    description: '经本机 ModelPort 转发；便于统一管理凭据与路由',
    supportsImages: false,
    provider: 'openai',
    runtime: 'modelport',
    external: false,
    aliases: [
      MODELPORT_DEEPSEEK_MODEL_ID,
      'modelport deepseek',
      'deepseek via modelport',
      'deepseek',
    ],
  },
  {
    id: DEEPSEEK_MODEL_ID,
    name: 'DeepSeek V4 Flash · 官方直连',
    description: '调用 DeepSeek 官方 API；需要配置 DEEPSEEK_API_KEY',
    supportsImages: false,
    provider: 'deepseek',
    runtime: 'deepseek-official',
    external: false,
    aliases: [
      DEEPSEEK_MODEL_ID,
      'deepseek direct',
      'deepseek official',
      'deepseek-official',
    ],
  },
];

export const PI_AGENT_DEFAULT_MODEL: PiAgentModelId = LOCAL_QWEN_MODEL_ID;

export function normalizePiAgentModelId(model?: string | null): PiAgentModelId {
  const normalized = model?.trim().toLowerCase();
  if (!normalized) return PI_AGENT_DEFAULT_MODEL;
  const match = PI_AGENT_MODEL_DEFINITIONS.find((definition) =>
    definition.id.toLowerCase() === normalized ||
    definition.aliases.some((alias) => alias.toLowerCase() === normalized),
  );
  return match?.id ?? PI_AGENT_DEFAULT_MODEL;
}

export function getPiAgentModelDefinition(id?: string | null): PiAgentModelDefinition {
  const normalized = normalizePiAgentModelId(id);
  return PI_AGENT_MODEL_DEFINITIONS.find((definition) => definition.id === normalized) ??
    PI_AGENT_MODEL_DEFINITIONS[0];
}

export function getPiAgentModelDisplayName(id?: string | null): string {
  return getPiAgentModelDefinition(id).name;
}

export function getDefaultModelForCli(_cli?: string | null): PiAgentModelId {
  return PI_AGENT_DEFAULT_MODEL;
}

export function normalizeModelId(_cli?: string | null, model?: string | null): PiAgentModelId {
  return normalizePiAgentModelId(model);
}

export function getModelDisplayName(_cli?: string | null, modelId?: string | null): string {
  return getPiAgentModelDisplayName(modelId);
}

export function getModelDefinitionsForCli(_cli?: string | null): PiAgentModelDefinition[] {
  return PI_AGENT_MODEL_DEFINITIONS;
}
