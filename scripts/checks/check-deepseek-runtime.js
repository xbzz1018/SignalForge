#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function readEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  for (const file of ['.env.local', '.env']) {
    const contents = readEnvFile(path.join(process.cwd(), file));
    const match = contents.match(new RegExp(`^${key}=["']?([^"'\\n]+)["']?$`, 'm'));
    if (match) return match[1];
  }
  return '';
}

function envFlag(key, fallback) {
  const value = readEnvValue(key).trim().toLowerCase();
  if (['0', 'false', 'no', 'off', 'disabled'].includes(value)) return false;
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(value)) return true;
  return fallback;
}

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || null;
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1].trim() || null : null;
}

function selectedProfile() {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'llm.json'), 'utf8'));
  } catch {
    return { requestedModel: optionValue('model') || '', profileId: null, profile: null, explicit: true };
  }
  const requestedModel = optionValue('model') || readEnvValue('QUANTPILOT_EVAL_MODEL').trim() || null;
  const defaultProfileId = typeof config.defaultProfileId === 'string' ? config.defaultProfileId : null;
  const requested = requestedModel || defaultProfileId;
  const entries = config.profiles && typeof config.profiles === 'object'
    ? Object.entries(config.profiles)
    : [];
  const match = entries.find(([profileId, profile]) => (
    profileId === requested || (profile && typeof profile === 'object' && profile.model === requested)
  ));
  return {
    requestedModel: requestedModel || defaultProfileId || '',
    profileId: match?.[0] || null,
    profile: match?.[1] || null,
    explicit: Boolean(requestedModel),
  };
}

function piAgentRuntimeExists() {
  return [
    'src/lib/agent/pi/run-engine.ts',
    'src/lib/agent/providers/deepseek.ts',
    'src/lib/agent/providers/openai-compatible.ts',
    'src/lib/agent/tools/index.ts',
    'src/lib/services/cli/pi-agent.ts',
  ].every((file) => fs.existsSync(path.join(process.cwd(), file)));
}

async function checkSelectedProvider() {
  const selection = selectedProfile();
  if (!selection.profile || typeof selection.profile !== 'object') {
    throw new Error(`未找到已注册模型：${selection.requestedModel || '(empty)'}`);
  }

  const profile = selection.profile;
  const credentialEnv = typeof profile.credentialEnv === 'string' ? profile.credentialEnv : '';
  const modelPortEnabled = envFlag('QUANTPILOT_MODELPORT_ENABLED', true);
  const apiKey = readEnvValue(credentialEnv).trim();
  const isDirectDeepSeek = profile.provider === 'deepseek' && credentialEnv === 'DEEPSEEK_API_KEY';
  if (isDirectDeepSeek) {
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置，无法运行官方直连模型。');
    if (profile.baseUrl !== 'https://api.deepseek.com') {
      throw new Error(`官方 DeepSeek Base URL 不匹配：${profile.baseUrl || '(empty)'}`);
    }
    console.log(`✅ 官方 DeepSeek：${selection.requestedModel} · ${profile.baseUrl}`);
    console.log('✅ DEEPSEEK_API_KEY 已配置（仅检查存在性，不输出值）');
    console.log(modelPortEnabled
      ? 'ℹ️ ModelPort：当前模型未选择 ModelPort 路由'
      : 'ℹ️ ModelPort：已按 QUANTPILOT_MODELPORT_ENABLED=0 停用');
    return;
  }

  if (credentialEnv !== 'MODELPORT_API_KEY') {
    throw new Error(`模型凭据边界不受支持：${credentialEnv || '(empty)'}`);
  }
  if (!modelPortEnabled) {
    console.log(`ℹ️ ModelPort：${selection.requestedModel} profile 已按 QUANTPILOT_MODELPORT_ENABLED=0 停用`);
    console.log('ℹ️ 未检查 MODELPORT_API_KEY 或 ModelPort livez；显式选择 deepseek-v4-flash 可使用官方直连。');
    return;
  }
  if (!apiKey) throw new Error('MODELPORT_API_KEY 未配置，无法运行当前模型。');
  const baseUrl = (readEnvValue('QUANTPILOT_MODELPORT_URL') || profile.baseUrl || '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('ModelPort Base URL 未配置。');
  const response = await fetch(`${baseUrl}/livez`, {
    signal: AbortSignal.timeout(2_500),
  });
  if (!response.ok) throw new Error(`ModelPort livez HTTP ${response.status}。`);
  console.log(`✅ ModelPort：${selection.requestedModel} · livez HTTP ${response.status}`);
  console.log('✅ MODELPORT_API_KEY 已配置（仅检查存在性，不输出值）');
}

async function main() {
  console.log('\n🔍 PI Agent · 模型 Provider 配置检查\n');
  console.log('默认模型：local_qwen:qwen3.5-9b-q5km');
  console.log('日常 DeepSeek：deepseek:deepseek-v4-flash（ModelPort）');
  console.log('可选直连：deepseek-v4-flash（官方 API）');

  if (!piAgentRuntimeExists()) {
    throw new Error('PI Agent 上游执行内核或 QuantPilot 适配层不完整。');
  }
  console.log('✅ PI Agent 核心、Provider、Tools 与产品接入层已就绪');
  await checkSelectedProvider();
  console.log('✅ Provider profile、凭据边界与运行端点检查完成\n');
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
