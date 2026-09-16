#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { loadProjectEnvironment } = require('../shared/load-env');
const { probeHttp } = require('../shared/http-probe');

const ROOT = process.cwd();
const FULL_CHECKS = process.argv.includes('--full');
loadProjectEnvironment({ rootDir: ROOT });

const checks = [];
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

function addCheck(name, status, summary, details = []) {
  const normalizedStatus = status === 'warn'
    ? 'warning'
    : status === 'fail'
      ? 'failed'
      : status;
  checks.push({ name, status: normalizedStatus, summary, details: details.filter(Boolean) });
}

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    error: result.error,
  };
}

function commandOutput(command, args = [], options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0 || result.error) return null;
  return result.stdout.split('\n').find(Boolean)?.trim() ?? '';
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readEnvValue(key) {
  return process.env[key] ?? '';
}

function envFlag(key, fallback) {
  const value = readEnvValue(key).trim().toLowerCase();
  if (!value) return fallback;
  if (FALSE_VALUES.has(value)) return false;
  if (TRUE_VALUES.has(value)) return true;
  return fallback;
}

function degradationConfig() {
  const modeValue = readEnvValue('QUANTPILOT_DEGRADATION_MODE').trim().toLowerCase();
  const mode = modeValue === 'strict' || modeValue === 'offline' ? modeValue : 'auto';
  const offline = mode === 'offline';
  const strict = mode === 'strict';
  return {
    mode,
    database: {
      enabled: offline ? false : envFlag('QUANTPILOT_DATABASE_ENABLED', true),
      required: offline ? false : envFlag('QUANTPILOT_DATABASE_REQUIRED', true),
    },
    marketApi: {
      enabled: offline ? false : envFlag('QUANTPILOT_MARKET_API_ENABLED', true),
      required: !offline && envFlag('QUANTPILOT_MARKET_API_REQUIRED', strict),
    },
    memory: {
      enabled: offline ? false : envFlag('QUANTPILOT_MEMORY_ENABLED', true),
      required: !offline && envFlag('QUANTPILOT_MEMORY_REQUIRED', false),
    },
    observability: {
      enabled: offline ? false : envFlag('QUANTPILOT_OBSERVABILITY_ENABLED', true),
      required: !offline && envFlag('QUANTPILOT_OBSERVABILITY_REQUIRED', strict),
    },
    modelPort: {
      enabled: offline ? false : envFlag('QUANTPILOT_MODELPORT_ENABLED', true),
      required: !offline && envFlag('QUANTPILOT_MODELPORT_REQUIRED', strict),
    },
  };
}

function unavailableStatus(component) {
  if (!component.enabled) return 'disabled';
  return component.required ? 'failed' : 'warning';
}

function componentMode(component) {
  if (!component.enabled) return 'disabled';
  return component.required ? 'required' : 'optional';
}

function hasPiAgentRuntime() {
  return [
    'src/lib/agent/pi/run-engine.ts',
    'src/lib/agent/providers/deepseek.ts',
    'src/lib/agent/providers/openai-compatible.ts',
    'src/lib/agent/tools/index.ts',
    'src/lib/services/cli/pi-agent.ts',
  ].every((file) => fs.existsSync(path.join(ROOT, file)));
}

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || null;
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1].trim() || null : null;
}

function selectedModelProfile() {
  const config = readJson(path.join(ROOT, 'config', 'llm.json'));
  const requestedModel = optionValue('model') || readEnvValue('QUANTPILOT_EVAL_MODEL').trim() || null;
  const defaultProfileId = typeof config?.defaultProfileId === 'string'
    ? config.defaultProfileId
    : null;
  const profileEntries = config?.profiles && typeof config.profiles === 'object'
    ? Object.entries(config.profiles)
    : [];
  const requested = requestedModel || defaultProfileId;
  const matched = profileEntries.find(([profileId, profile]) => (
    profileId === requested || (profile && typeof profile === 'object' && profile.model === requested)
  ));
  if (!matched) {
    return {
      requestedModel: requestedModel || defaultProfileId || '',
      explicit: Boolean(requestedModel),
      profileId: null,
      profile: null,
    };
  }
  return {
    requestedModel: requestedModel || matched[0],
    explicit: Boolean(requestedModel),
    profileId: matched[0],
    profile: matched[1],
  };
}

async function checkModelProviders(degradation) {
  const selection = selectedModelProfile();
  if (!selection.profile || typeof selection.profile !== 'object') {
    addCheck(
      '模型选择',
      'failed',
      `未找到已注册模型：${selection.requestedModel || '(empty)'}`,
      ['使用 --model=<registered-model>，或检查 config/llm.json。'],
    );
    return;
  }

  const profile = selection.profile;
  const credentialEnv = typeof profile.credentialEnv === 'string' ? profile.credentialEnv : '';
  const isDirectDeepSeek = profile.provider === 'deepseek' && credentialEnv === 'DEEPSEEK_API_KEY';
  const modelPortBaseUrl = (readEnvValue('QUANTPILOT_MODELPORT_URL') || 'http://127.0.0.1:38082')
    .replace(/\/$/, '');

  const deepSeekApiKey = readEnvValue('DEEPSEEK_API_KEY');
  addCheck(
    'DeepSeek 官方 API',
    isDirectDeepSeek
      ? (deepSeekApiKey ? 'ok' : (selection.explicit ? 'failed' : 'warning'))
      : (deepSeekApiKey ? 'ok' : 'disabled'),
    isDirectDeepSeek
      ? (deepSeekApiKey
        ? `${selection.requestedModel} · 官方直连 · API Key 已配置`
        : `${selection.requestedModel} 已选择，但 DEEPSEEK_API_KEY 未配置。`)
      : (deepSeekApiKey ? '官方直连凭据已配置，但当前未选择直连模型。' : '未选择官方直连，按配置停用。'),
    isDirectDeepSeek
      ? (deepSeekApiKey ? ['Base URL 固定为 https://api.deepseek.com。'] : ['在本机 .env.local 配置 DEEPSEEK_API_KEY。'])
      : ['选择 --model=deepseek-v4-flash 才会使用官方直连。'],
  );

  const modelPortSelected = credentialEnv === 'MODELPORT_API_KEY';
  const modelPortApiKey = readEnvValue('MODELPORT_API_KEY');
  if (!modelPortSelected) {
    addCheck(
      'ModelPort Provider',
      'disabled',
      degradation.modelPort.enabled
        ? `当前选择 ${selection.requestedModel}，未使用 ModelPort。`
        : '已按 QUANTPILOT_MODELPORT_ENABLED=0 停用。',
      ['本地 Qwen/ModelPort profile 保留；选择对应模型并配置客户端 Key 后才会启用。'],
    );
    return;
  }

  if (!degradation.modelPort.enabled) {
    addCheck(
      'ModelPort Provider',
      'disabled',
      `当前选择 ${selection.requestedModel}，ModelPort 已按配置停用。`,
      ['本地 Qwen/ModelPort profile 保留；设置 QUANTPILOT_MODELPORT_ENABLED=1 后才会检查服务。'],
    );
    return;
  }
  if (!modelPortApiKey) {
    addCheck(
      'ModelPort Provider',
      degradation.modelPort.required ? 'failed' : 'warning',
      '当前选择的默认模型不可用：MODELPORT_API_KEY 未配置。',
      ['在本机 .env.local 中填写 ModelPort 客户端 API Key。'],
    );
    return;
  }
  const livez = await requestHead(`${modelPortBaseUrl}/livez`);
  addCheck(
    'ModelPort Provider',
    livez.ok ? 'ok' : unavailableStatus(degradation.modelPort),
    livez.ok
      ? `ModelPort livez HTTP ${livez.statusCode} · ${selection.requestedModel}`
      : `ModelPort 未就绪 · ${selection.requestedModel}`,
    livez.ok ? [] : [`目标：${modelPortBaseUrl}/livez`],
  );
}

async function checkDatabase() {
  const degradation = degradationConfig();
  if (!degradation.database.enabled) {
    addCheck('数据库', 'disabled', '已按降级配置停用。', ['数据库关闭时，依赖历史行情和项目索引的页面会展示有限兜底数据。']);
    return;
  }

  const databaseUrl = readEnvValue('DATABASE_URL');
  if (!databaseUrl) {
    addCheck('数据库', unavailableStatus(degradation.database), 'DATABASE_URL 未配置。');
    return;
  }

  const provider =
    databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')
      ? 'PostgreSQL'
      : 'unsupported';

  const prisma = new PrismaClient();
  try {
    if (provider !== 'PostgreSQL') {
      addCheck('数据库', unavailableStatus(degradation.database), `${provider} DATABASE_URL。`, ['运行 npm run ensure:env 重新生成 PostgreSQL 配置。']);
      return;
    }
    await prisma.project.findFirst({ select: { id: true } });

    const extensionRows =
      await prisma.$queryRaw`SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'`;
    const timescaleVersion = Array.isArray(extensionRows) && extensionRows[0]?.extversion
      ? extensionRows[0].extversion
      : '';
    addCheck(
      '数据库',
      timescaleVersion ? 'ok' : 'warn',
      timescaleVersion
        ? `PostgreSQL 可连接，TimescaleDB ${timescaleVersion} 已启用。`
        : 'PostgreSQL 可连接，但未检测到 TimescaleDB 扩展。',
      timescaleVersion ? [] : ['运行 npm run db:up && npm run db:init。']
    );
  } catch (error) {
    addCheck(
      '数据库',
      unavailableStatus(degradation.database),
      `${provider} 连接或 schema 检查失败。`,
      [
        error instanceof Error ? error.message : String(error),
        provider === 'PostgreSQL' ? '运行 npm run db:up && npm run db:init。' : null,
      ]
    );
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

function requestHead(url, timeoutMs = 8000) {
  return probeHttp(url, { method: 'HEAD', timeoutMs });
}

function requestGetOk(url, timeoutMs = 2500) {
  return probeHttp(url, { timeoutMs });
}

function requestJson(url, timeoutMs = 2500) {
  return probeHttp(url, { json: true, timeoutMs });
}

function summarizeCommandFailure(result) {
  return (result.stderr || result.stdout || result.error?.message || 'command failed')
    .split('\n')
    .filter(Boolean)
    .slice(-6);
}

function latestBenchmarkReport() {
  const reportsDir = path.join(ROOT, 'tmp', 'quantpilot-benchmark-reports');
  if (!fs.existsSync(reportsDir)) return null;
  const files = fs
    .readdirSync(reportsDir)
    .filter((fileName) => /^report-\d+\.json$/.test(fileName))
    .map((fileName) => {
      const filePath = path.join(reportsDir, fileName);
      return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (!files[0]) return null;
  const report = readJson(files[0].filePath);
  return report ? { filePath: files[0].filePath, report } : null;
}

function checkCommand(name, command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status === 0) {
    addCheck(name, 'ok', options.successSummary ?? '通过。', options.successDetails ? options.successDetails(result) : []);
    return true;
  }
  addCheck(name, options.warnOnly ? 'warn' : 'fail', options.failureSummary ?? '未通过。', summarizeCommandFailure(result));
  return false;
}

async function main() {
  console.log(`\nQuantPilot Doctor ${FULL_CHECKS ? '(full)' : '(quick)'}\n`);
  const degradation = degradationConfig();

  const packageJson = readJson(path.join(ROOT, 'package.json'));
  addCheck('项目配置', packageJson?.name === 'quantpilot' ? 'ok' : 'fail', packageJson ? `${packageJson.name}@${packageJson.version}` : '无法读取 package.json。');
  addCheck(
    '降级配置',
    'ok',
    `${degradation.mode} · DB ${componentMode(degradation.database)} · Market API ${componentMode(degradation.marketApi)} · Memory ${componentMode(degradation.memory)} · ModelPort ${componentMode(degradation.modelPort)} · Observability ${componentMode(degradation.observability)}`,
    ['auto 适合本地开发；strict 适合 CI/生产；offline 会跳过可选外部组件。']
  );

  const nodeVersion = commandOutput('node', ['--version']);
  const npmVersion = commandOutput('npm', ['--version']);
  const uvVersion = commandOutput('uv', ['--version'], { cwd: path.join(ROOT, 'services', 'market-data') });
  addCheck(
    '工具版本',
    nodeVersion && npmVersion && uvVersion ? 'ok' : 'fail',
    `node=${nodeVersion || '-'} npm=${npmVersion || '-'} uv=${uvVersion || '-'}`,
    [
      nodeVersion ? null : 'Node.js 不可用。',
      npmVersion ? null : 'npm 不可用。',
      uvVersion ? null : 'uv 不可用。',
    ]
  );

  await checkModelProviders(degradation);

  const upstreamAgentRuntime = hasPiAgentRuntime();
  addCheck(
    'Agent 执行引擎',
    upstreamAgentRuntime ? 'ok' : 'fail',
    upstreamAgentRuntime ? '开源 PI Agent 执行内核已就绪。' : '开源 PI Agent 执行内核缺失。',
    [
      upstreamAgentRuntime ? null : '运行 npm install 重新安装依赖。',
    ]
  );

  const frontend = await requestHead('http://localhost:3000/');
  addCheck(
    '前端服务 :3000',
    frontend.ok ? 'ok' : 'warn',
    frontend.ok ? `HTTP ${frontend.statusCode}` : '未连接。',
    frontend.ok ? [] : ['运行 npm run dev 可启动主前端。']
  );

  if (degradation.marketApi.enabled) {
    const backend = await requestJson('http://127.0.0.1:8000/health');
    addCheck(
      '量化数据后端 :8000',
      backend.ok ? 'ok' : unavailableStatus(degradation.marketApi),
      backend.ok ? `HTTP ${backend.statusCode}` : '未连接，已使用数据源注册表/本地数据兜底。',
      backend.ok ? [] : ['进入 services/market-data 后运行 uv run quantpilot-market-api。']
    );
  } else {
    addCheck('量化数据后端 :8000', 'disabled', '已按降级配置停用。', ['策略平台和业务知识中心会优先展示本地/内置兜底数据。']);
  }

  if (degradation.memory.enabled) {
    const memoryBaseUrl = (readEnvValue('QUANTPILOT_MEMORY_API_URL') || 'http://127.0.0.1:38089')
      .replace(/\/$/, '');
    const [discovery, ready] = await Promise.all([
      requestJson(`${memoryBaseUrl}/`, 2500),
      requestJson(`${memoryBaseUrl}/readyz`, 2500),
    ]);
    const contractOk = discovery.data?.api_contract === 'evolvable-memory-http/v1';
    const memoryOk = discovery.ok && ready.ok && contractOk;
    addCheck(
      '外部 Memory',
      memoryOk ? 'ok' : unavailableStatus(degradation.memory),
      memoryOk ? 'discovery / readyz / evolvable-memory-http/v1 通过。' : '未连接或契约不兼容。',
      memoryOk
        ? []
        : [
            `目标：${memoryBaseUrl}`,
            discovery.ok && !contractOk ? 'discovery 的 api_contract 不匹配。' : null,
            degradation.memory.required
              ? '该组件已标记 required，恢复服务后才能通过 doctor。'
              : '该组件为 optional；未启动时个性化记忆会降级，不阻断核心研究流程。',
          ]
    );
  } else {
    addCheck('外部 Memory', 'disabled', '已按降级配置停用。');
  }

  if (degradation.observability.enabled) {
    const lokiUrl = readEnvValue('LOKI_URL') || 'http://127.0.0.1:33100';
    const loki = await requestGetOk(`${lokiUrl.replace(/\/$/, '')}/ready`, 2500);
    addCheck(
      'Loki 可观测性',
      loki.ok ? 'ok' : unavailableStatus(degradation.observability),
      loki.ok ? `HTTP ${loki.statusCode}` : '未连接，运行治理中心将使用本地日志文件兜底。',
      loki.ok ? [] : ['运行 npm run obs:up。']
    );
  } else {
    addCheck('Loki 可观测性', 'disabled', '已按降级配置停用。', ['运行治理中心仍会读取本地日志文件。']);
  }

  const projectsDir = readEnvValue('PROJECTS_DIR') || './data/projects';
  const projectRoot = path.resolve(ROOT, projectsDir);
  const projectCount = fs.existsSync(projectRoot)
    ? fs.readdirSync(projectRoot).filter((item) => item.startsWith('project-')).length
    : 0;
  addCheck('工作空间目录', fs.existsSync(projectRoot) ? 'ok' : 'warn', `${path.relative(ROOT, projectRoot)} (${projectCount} 个项目)`);
  await checkDatabase();
  if (degradation.database.enabled) {
    checkCommand('行情新鲜度', 'node', ['scripts/checks/check-market-data-freshness.js'], {
      successSummary: '交易日历与本地 daily/qfq 日线已跟进最近完成交易日。',
      failureSummary: '本地行情数据已过期。',
      warnOnly: true,
    });
  } else {
    addCheck('行情新鲜度', 'disabled', '数据库已停用，跳过本地行情新鲜度检查。');
  }

  checkCommand('Skills 注册表', 'node', ['scripts/checks/check-skills-registry.js', '--check-lock'], {
    successSummary: 'registry / changelog / lock / package 一致。',
  });
  checkCommand('生成产物策略', 'node', ['scripts/checks/check-generated-artifact-policy.js'], {
    successSummary: 'artifact policy smoke 通过。',
  });
  checkCommand('验证修复契约', 'node', ['scripts/checks/check-validation-repair.js'], {
    successSummary: 'validation repair smoke 通过。',
  });
  checkCommand('验证过期检查', 'node', ['scripts/checks/check-validation-stale-report.js'], {
    successSummary: 'stale validation smoke 通过。',
  });
  checkCommand('Benchmark 覆盖', 'node', ['scripts/checks/check-quant-benchmark-coverage.js'], {
    successSummary: '固定评测覆盖达标。',
  });
  checkCommand('服务目录', 'node', ['scripts/checks/check-service-catalog.js'], {
    successSummary: '服务边界、依赖和文档同步通过。',
  });
  checkCommand('模块边界', 'node', ['scripts/checks/check-module-boundaries.js'], {
    successSummary: '模块清单、反向依赖和大文件预算通过。',
  });
  checkCommand('Eval 定时器', 'node', ['scripts/checks/check-eval-schedule.js'], {
    successSummary: '定时评测检查通过。',
  });

  const report = latestBenchmarkReport();
  if (report) {
    const total = Number(report.report.total || 0);
    const passed = Number(report.report.passedCount || 0);
    const failed = Number(report.report.failedCount || 0);
    const passRate = Number(report.report.passRate ?? (total ? Math.round((passed / total) * 100) : 0));
    addCheck(
      '最近评测报告',
      failed ? 'warn' : 'ok',
      `${path.relative(ROOT, report.filePath)} · ${passed}/${total} · ${passRate}%`,
      failed ? [`失败用例：${failed}`] : []
    );
  } else {
    addCheck('最近评测报告', 'warn', '未找到 tmp/quantpilot-benchmark-reports/report-*.json。', ['运行 npm run benchmark:quant:contract 可生成报告。']);
  }

  if (FULL_CHECKS) {
    checkCommand('ESLint', 'npm', ['run', 'lint'], { successSummary: 'lint 通过。' });
    checkCommand('TypeScript', 'npm', ['run', 'type-check'], { successSummary: 'type-check 通过。' });
    checkCommand('后端 Ruff', 'uv', ['run', '--no-sync', 'ruff', 'check', '.'], {
      cwd: path.join(ROOT, 'services', 'market-data'),
      successSummary: 'ruff 通过。',
    });
    checkCommand('后端 Pytest', 'uv', ['run', '--no-sync', 'pytest'], {
      cwd: path.join(ROOT, 'services', 'market-data'),
      successSummary: 'pytest 通过。',
    });
  } else {
    addCheck('Full checks', 'warn', '已跳过 lint/type-check/后端测试。', ['使用 npm run doctor:full 运行完整诊断。']);
  }

  const statusIcon = { ok: '✓', warning: '!', failed: '✕', disabled: '·' };
  for (const check of checks) {
    console.log(`${statusIcon[check.status]} ${check.name}: ${check.summary}`);
    for (const detail of check.details) {
      console.log(`  - ${detail}`);
    }
  }

  const counts = checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { ok: 0, warning: 0, failed: 0, disabled: 0 }
  );
  console.log(`\nSummary: ${counts.ok} ok, ${counts.warning} warning, ${counts.failed} fail, ${counts.disabled} disabled\n`);
  if (counts.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[doctor] failed:', error);
  process.exit(1);
});
