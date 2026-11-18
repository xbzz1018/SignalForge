import { expect, test } from 'playwright/test';

test('opens the research composer first and selects backtest from the starter', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '新建量化研究' })).toBeVisible();
  const composer = page.getByRole('textbox', { name: '量化分析需求' });
  await expect(composer).toBeInViewport();
  await page.getByRole('button', { name: '510300 均线回测' }).click();
  await expect(composer).toHaveValue(/20\/60 日均线.*510300/);
  const backtest = page.getByRole('tab', { name: '策略回测' });
  await expect(backtest).toHaveAttribute('aria-selected', 'true');
  await backtest.focus();
  await backtest.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '基本面分析' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('research-home.png'), animations: 'disabled' });
});
