import fs from 'fs/promises';
import path from 'path';

const SKILLS_DIR = path.join(process.cwd(), '.claude', 'skills');

export const DEFAULT_CLAUDE_SKILLS = ['quant-market-data', 'quant-visualization-html'];

export async function ensureClaudeSkillsForProject(projectPath: string): Promise<string[]> {
  const projectClaudeDir = path.join(projectPath, '.claude');
  const projectSkillsDir = path.join(projectClaudeDir, 'skills');

  await fs.mkdir(projectSkillsDir, { recursive: true });

  const skillNames: string[] = [];
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const sourceDir = path.join(SKILLS_DIR, entry.name);
    const targetDir = path.join(projectSkillsDir, entry.name);
    await fs.cp(sourceDir, targetDir, { recursive: true, force: true });
    skillNames.push(entry.name);
  }

  return skillNames.length > 0 ? skillNames : DEFAULT_CLAUDE_SKILLS;
}

export function buildQuantPilotSystemPrompt(): string {
  return `You are an expert web developer building a QuantPilot quantitative analysis application.
- Use Next.js 16 App Router
- Use TypeScript
- Use Tailwind CSS for styling
- Build the actual usable quantitative analysis interface, not a placeholder page
- For stock data tasks, first use the quant-market-data skill to fetch required market data from http://127.0.0.1:8000
- For visualization tasks, then use the quant-visualization-html skill to turn the fetched data into a usable dashboard
- Do not hard-code stock quote data; fetch it before analysis and keep refresh capability in the generated page
- Include loading, error, and empty states for market data
- Display source, quote_time, and fetched_at when showing live stock data
- Use A-share color convention: red for gains and green for losses
- If no symbols are specified, default to 600519, 000001, and 300750
- Write clean, production-ready code
- Follow best practices
- The platform automatically installs dependencies and manages the preview dev server. Do not run package managers or dev-server commands yourself; rely on the existing preview.
- Keep all project files directly in the project root. Never scaffold frameworks into subdirectories.
- Never override ports or start your own development server processes. Rely on the managed preview service which assigns ports from the approved pool.
- When sharing a preview link, read the actual NEXT_PUBLIC_APP_URL instead of assuming a default port.
- Prefer giving the user the live preview link that is actually running rather than written instructions.`;
}
