import fs from 'fs/promises';
import path from 'path';
import { prefetchQuantDataForRunPlan } from "@/lib/quant/data-prefetch";
import { ensureQuantWorkspace } from '@/lib/domains/finance/workspace';
import type { QuantRunPlan } from '@/lib/domains/finance/workspace';
import { ensureGeneratedNextConfig, generatedBuildScriptContents, scaffoldBasicNextApp } from '@/lib/utils/scaffold';
import { type PrepareQuantProjectForValidationParams, VALIDATION_STALE_ARTIFACT_PATHS } from './contracts';
import { readTextFile } from './files';
import {
  extractPlannedSymbols,
  inspectDashboardDataPayload,
  isStructuredEmptyScreenerResult,
  readRunPlan,
} from './inputs';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function validationArtifactSignature(projectPath: string): Promise<string> {
  const signatures = await Promise.all(
    VALIDATION_STALE_ARTIFACT_PATHS.map(async (relativePath) => {
      const absolutePath = path.join(projectPath, relativePath);
      const stat = await fs.stat(absolutePath).catch(() => null);
      if (!stat?.isFile()) {
        return `${relativePath}:missing`;
      }
      return `${relativePath}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
    })
  );
  return signatures.join('|');
}

async function waitForValidationArtifactsToSettle(projectPath: string) {
  const timeoutMs = Number.parseInt(process.env.SIGNALFORGE_VALIDATION_SETTLE_TIMEOUT_MS ?? '', 10) || 4_000;
  const intervalMs = 500;
  const startedAt = Date.now();
  let lastSignature = '';
  let stableCount = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const signature = await validationArtifactSignature(projectPath);
    if (signature === lastSignature) {
      stableCount += 1;
      if (stableCount >= 2) {
        return;
      }
    } else {
      lastSignature = signature;
      stableCount = 0;
    }
    await sleep(intervalMs);
  }
}

export async function normalizeGeneratedProjectForValidation(projectPath: string) {
  await normalizePostCssConfig(projectPath);
  await normalizeBuildScript(projectPath);
  await ensureGeneratedNextConfig(path.join(projectPath, 'next.config.js'));
}

async function normalizePostCssConfig(projectPath: string) {
  const postCssPath = path.join(projectPath, 'postcss.config.js');
  const content = await readTextFile(postCssPath);
  if (content === null) {
    return;
  }

  const compact = content.replace(/\s+/g, '');
  const hasPluginsKey = /\bplugins\s*:/.test(content) || compact.includes('"plugins":') || compact.includes("'plugins':");
  const isEmptyExport = /module\.exports\s*=\s*\{\s*\}\s*;?/.test(content) || /export\s+default\s+\{\s*\}\s*;?/.test(content);

  if (hasPluginsKey && !isEmptyExport) {
    return;
  }

  await fs.writeFile(
    postCssPath,
    `module.exports = {
  plugins: [],
};
`,
    'utf8'
  );
}

async function normalizeBuildScript(projectPath: string) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const raw = await readTextFile(packageJsonPath);
  if (!raw) {
    return;
  }

  let packageJson: Record<string, unknown>;
  try {
    packageJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }

  let changed = false;
  const scripts = packageJson.scripts;
  if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) {
    packageJson.scripts = {};
    changed = true;
  }

  const scriptMap = packageJson.scripts as Record<string, unknown>;
  if (
    scriptMap.build !== 'node scripts/run-build.js' &&
    (typeof scriptMap.build !== 'string' || /^next\s+build(?:\s|$)/.test(scriptMap.build))
  ) {
    scriptMap.build = 'node scripts/run-build.js';
    changed = true;
  }
  if (!scriptMap.build) {
    scriptMap.build = 'node scripts/run-build.js';
    changed = true;
  }

  const buildScriptPath = path.join(projectPath, 'scripts', 'run-build.js');
  const buildScript = generatedBuildScriptContents();
  if ((await readTextFile(buildScriptPath)) !== buildScript) {
    await fs.mkdir(path.dirname(buildScriptPath), { recursive: true });
    await fs.writeFile(buildScriptPath, buildScript, 'utf8');
  }

  if (
    !packageJson.dependencies ||
    typeof packageJson.dependencies !== 'object' ||
    Array.isArray(packageJson.dependencies)
  ) {
    packageJson.dependencies = {};
    changed = true;
  }

  const dependencies = packageJson.dependencies as Record<string, unknown>;
  if (dependencies['next-rspack']) {
    delete dependencies['next-rspack'];
    changed = true;
  }

  const devDependencies = packageJson.devDependencies;
  if (
    devDependencies &&
    typeof devDependencies === 'object' &&
    !Array.isArray(devDependencies) &&
    (devDependencies as Record<string, unknown>)['next-rspack']
  ) {
    delete (devDependencies as Record<string, unknown>)['next-rspack'];
    changed = true;
  }

  if (changed) {
    await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }
}

async function ensurePrefetchedFinalData(projectPath: string) {
  const runPlan = await readRunPlan(projectPath);
  if (!runPlan) {
    return;
  }

  const raw = await readTextFile(path.join(projectPath, 'data_file', 'final', 'dashboard-data.json'));
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const inspection = inspectDashboardDataPayload(parsed);
  const plannedSymbols = extractPlannedSymbols(runPlan);
  const missingSymbols = plannedSymbols.filter((symbol) => !inspection.fetchedSymbols.includes(symbol));
  if (raw && (inspection.hasUsableMarketData || isStructuredEmptyScreenerResult(parsed)) && missingSymbols.length === 0) {
    return;
  }

  try {
    await prefetchQuantDataForRunPlan({
      projectPath,
      plan: runPlan as unknown as QuantRunPlan,
    });
  } catch (error) {
    console.warn(
      '[QuantValidation] Failed to prefetch final dashboard data before validation:',
      error
    );
  }
}

/**
 * Apply every trusted, validation-owned workspace mutation before evidence is
 * frozen. Checks may defensively repeat normalization, but those writes must be
 * content-idempotent after this boundary.
 */
export async function prepareQuantProjectForValidation(
  params: PrepareQuantProjectForValidationParams,
): Promise<string> {
  const projectPath = path.resolve(/*turbopackIgnore: true*/ params.projectPath);

  await ensureQuantWorkspace(projectPath);
  await waitForValidationArtifactsToSettle(projectPath);
  await ensurePrefetchedFinalData(projectPath);
  await scaffoldBasicNextApp(projectPath, params.projectId);
  await normalizeGeneratedProjectForValidation(projectPath);
  await waitForValidationArtifactsToSettle(projectPath);

  return projectPath;
}
