import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loadCatalog } from '../../scripts/catalog.mjs';

const published = loadCatalog().published;
const total = published.length;
const making = published.filter(item => item.domain === 'making').length;

test('grounds render without errors, external requests, or horizontal overflow', async ({ page }) => {
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4174/')) external.push(request.url()); });
  await page.goto('./');
  await expect(page.locator('.grave:visible')).toHaveCount(total);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('search includes preserved source, filters intersect, and empty state resets', async ({ page }) => {
  await page.goto('./');
  await page.locator('#search').fill('validateProblemData');
  await expect(page.locator('.grave:visible')).toHaveCount(1);
  await expect(page.locator('.grave:visible')).toContainText('Problem Space');
  await page.getByRole('button', { name: 'Index', exact: true }).click();
  await expect(page.locator('.index-row:visible')).toHaveCount(1);
  await page.locator('#type-filter').selectOption('quote');
  await expect(page.getByText('Quiet in this corner.')).toBeVisible();
  await page.getByRole('button', { name: 'Wander back to everything' }).click();
  await expect(page.locator('.index-row:visible')).toHaveCount(total);
});

test('filters are linkable, history works, graph and related links navigate', async ({ page }) => {
  await page.goto('./?domain=making&view=connections');
  await expect(page.locator('#result-count')).toHaveText(`${making} of ${total} things found`);
  await expect(page.locator('.item-node')).toHaveCount(Math.min(making, 30));
  await page.getByRole('button', { name: 'All corners' }).click();
  await expect(page.locator('.item-node')).toHaveCount(Math.min(total, 30));
  await page.goBack();
  await expect(page.locator('.item-node')).toHaveCount(Math.min(making, 30));
  await page.locator('.item-node[aria-label="Problem Space"]').click();
  await expect(page).toHaveURL(/\/graveyard\/items\/problem-space\//);
  await expect(page.getByRole('heading', { name: 'WHAT', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'source/scripts/problem-data.mjs Read source' }).click();
  await expect(page.locator('.source-code')).toContainText('validateProblemData');
});

test('daylight choice survives navigation and can return to dark', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Switch to daylight' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('.grave').first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('intake dialog closes with Escape and restores focus; random opens a real burial', async ({ page }) => {
  await page.goto('./');
  const trigger = page.getByRole('link', { name: 'Leave something' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Dig something up' }).click();
  await expect(page).toHaveURL(/\/graveyard\/items\/[a-z-]+\/$/);
  await expect(page.getByRole('heading', { name: 'WHY', exact: true })).toBeVisible();
});

test('keyboard search shortcut and reduced-motion setting work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.keyboard.press('/');
  await expect(page.locator('#search')).toBeFocused();
  await page.keyboard.type('sapkowski');
  await expect(page.locator('.grave:visible')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.grave:visible')).toHaveCount(total);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
});

test('navigation and source reading work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4174/graveyard/');
  await expect(page.locator('.grave')).toHaveCount(total);
  await page.locator('.grave[data-id="problem-space"]').click();
  await expect(page.getByRole('heading', { name: 'Problem Space', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'source/scripts/problem-data.mjs Read source' }).click();
  await expect(page.locator('.source-code')).toBeVisible();
  await context.close();
});

test('copy prompt confirms success and has a visible fallback', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }));
  await page.getByRole('link', { name: 'Leave something' }).click();
  await page.getByRole('button', { name: 'Copy prompt' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Unavailable'); } } }));
  await page.getByRole('button', { name: 'Copied' }).click();
  await expect(page.getByRole('button', { name: 'Select the prompt above to copy' })).toBeVisible();
});

test('dark and daylight grounds, graph, and reading page pass accessibility checks', async ({ browser }) => {
  // Only the audit context bypasses CSP so axe can inject its analysis code.
  // The product CSP is exercised unchanged in the ordinary browser tests.
  const context = await browser.newContext({ bypassCSP: true });
  const page = await context.newPage();
  for (const theme of ['dark', 'light']) {
    for (const route of ['', '?view=connections', 'items/problem-space/']) {
      await page.goto(`http://127.0.0.1:4174/graveyard/${route}`);
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations, `${theme}: ${route}`).toEqual([]);
    }
  }
  await context.close();
});
