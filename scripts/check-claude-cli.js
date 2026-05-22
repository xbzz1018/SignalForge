#!/usr/bin/env node
/**
 * Claude Code CLI 与 MiniMax 环境检查脚本
 *
 * 运行：npm run check-cli
 */

const { execSync } = require('child_process');

console.log('\n🔍 Claude Code CLI 与 MiniMax 配置检查\n');

console.log('1️⃣  检查 Claude Code CLI 是否已安装...');
try {
  const version = execSync('claude --version', { encoding: 'utf-8', stdio: 'pipe' }).trim();
  console.log(`   ✅ 已安装：${version}\n`);
} catch (error) {
  console.log('   ❌ 未安装 Claude Code CLI。\n');
  console.log('   安装命令：');
  console.log('   $ npm install -g @anthropic-ai/claude-code\n');
  process.exit(1);
}

console.log('2️⃣  检查 CLI 是否可运行...');
try {
  execSync('claude --help', { encoding: 'utf-8', stdio: 'pipe' });
  console.log('   ✅ CLI 可正常运行。\n');
} catch (error) {
  console.log('   ⚠️  CLI 运行时出现异常。\n');
}

console.log('3️⃣  检查 MiniMax 相关环境变量');
const requiredEnv = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL'];
for (const key of requiredEnv) {
  const value = process.env[key];
  if (!value) {
    console.log(`   ⚠️  ${key} 未在当前 shell 环境中设置。`);
  } else if (key === 'ANTHROPIC_AUTH_TOKEN') {
    console.log(`   ✅ ${key}=已设置`);
  } else {
    console.log(`   ✅ ${key}=${value}`);
  }
}

console.log('\n✨ QuantPilot 已准备好使用 Claude Code 运行时。\n');
console.log('   下一步：');
console.log('   1. 确认 .env/.env.local 或 ~/.claude/settings.json 中已配置 MiniMax Token');
console.log('   2. npm run dev - 启动开发服务');
console.log('   3. 访问 http://localhost:3000\n');

console.log('────────────────────────────────────────────────────────────');
console.log('💡 提示：当前方案使用 Claude Code 作为运行时，并通过 Anthropic-compatible 参数接入 MiniMax。');
console.log('────────────────────────────────────────────────────────────\n');
