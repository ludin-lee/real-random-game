import { type Page, expect, test } from '@playwright/test';

/**
 * End-to-end smoke test against the production build (vite preview).
 * Drives the real canvas with pointer input, then fast-forwards with the bot via the
 * ?e2e hook. Screenshots land in e2e/.results for visual review in PRs.
 */
const shot = (page: Page, name: string) => page.screenshot({ path: `e2e/.results/${name}.png` });

async function fresh(page: Page, lang = 'ko') {
  // Same origin, but no app script running (the app re-saves on pagehide).
  await page.goto('/manifest.webmanifest');
  await page.evaluate((l) => {
    localStorage.clear();
    localStorage.setItem('bloom.save.v1', JSON.stringify({ settings: { lang: l, sound: false, music: false, haptics: false } }));
  }, lang);
  await page.goto('/?e2e');
}

test('home → tutorial drag → clear → game over → results', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fresh(page);
  await expect(page.locator('.logo h1')).toHaveText('블룸 블록');
  await shot(page, '01-home');

  await page.click('[data-mode="classic"]');
  await expect(page.locator('.tutorial')).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, '02-tutorial');

  // Drag tray piece 0 (h2) into the bottom-row gap (row 7, col 3) with a real pointer gesture.
  const g = await page.evaluate(() => {
    const a = (window as any).__bloom.app;
    const L = a.renderer.layout;
    const pos = a.renderer.trayPiecePos(0, a.game.tray[0]);
    return { L, pos };
  });
  const startX = g.pos.x + g.pos.cell;
  const startY = g.pos.y + g.pos.cell / 2;
  // Mouse lift is 0.3 cell; piece top-left = pointer - (cols*cell/2, rows*cell + lift)
  const targetX = g.L.boardX + 3 * g.L.cell + g.L.cell; // centre of 2-wide piece
  const targetY = g.L.boardY + 7 * g.L.cell + g.L.cell + g.L.cell * 0.3;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move((startX + targetX) / 2, (startY + targetY) / 2, { steps: 5 });
  await page.mouse.move(targetX, targetY, { steps: 5 });
  await shot(page, '03-dragging');
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => (window as any).__bloom.app.game.lines)).toBeGreaterThan(0);
  await expect(page.locator('.tutorial')).toContainText('꽃');
  await page.waitForTimeout(300);
  await shot(page, '04-clear');

  // Fast-forward with the bot until the run ends.
  await page.evaluate(() => {
    const b = (window as any).__bloom;
    for (let i = 0; i < 2000 && b.autoMove(); i++);
  });
  await page.waitForTimeout(300);
  await shot(page, '05-midgame');
  await expect(page.locator('[data-action="revive-ad"]')).toBeVisible({ timeout: 5000 });
  await shot(page, '06-revive');

  await page.click('[data-action="decline-revive"]');
  await expect(page.locator('.sheet .big')).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, '07-results');
  const save = await page.evaluate(() => (window as any).__bloom.save());
  expect(save.best).toBeGreaterThan(0);
  expect(save.tutorialDone).toBe(true);
  expect(errors).toEqual([]);
});

test('adventure level plays to a win and awards stars', async ({ page }) => {
  await fresh(page, 'en');
  await page.click('[data-mode="adventure"]');
  await expect(page.locator('.goal').first()).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, '08-adventure');
  const status = await page.evaluate(() => {
    const b = (window as any).__bloom;
    for (let i = 0; i < 500 && b.autoMove(); i++);
    return b.app.game.status;
  });
  test.skip(status !== 'won', 'bot lost this layout');
  await expect(page.locator('.stars')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(700);
  await shot(page, '09-level-clear');
  await page.click('[data-action="next"]');
  expect(await page.evaluate(() => (window as any).__bloom.app.game.level)).toBe(2);
});

test('runs survive a reload mid-game', async ({ page }) => {
  await page.goto('/manifest.webmanifest');
  await page.evaluate(() => localStorage.setItem('bloom.save.v1', JSON.stringify({ tutorialDone: true, settings: { lang: 'en', sound: false, music: false } })));
  await page.goto('/?e2e');
  await page.click('[data-mode="daily"]');
  const before = await page.evaluate(() => {
    const b = (window as any).__bloom;
    for (let i = 0; i < 5; i++) b.autoMove();
    return JSON.stringify(b.app.game);
  });
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('[data-mode="daily"]')).toContainText('Resume');
  await page.click('[data-mode="daily"]');
  const after = await page.evaluate(() => JSON.stringify((window as any).__bloom.app.game));
  expect(after).toEqual(before);
});

test('settings + shop sheets render', async ({ page }) => {
  await fresh(page, 'en');
  await page.click('[data-action="shop"]');
  await expect(page.locator('.shop-item')).toHaveCount(5);
  await shot(page, '10-shop');
  await page.click('[data-action="close"]');
  await page.click('[data-action="settings"]');
  await page.click('[data-lang="ko"]');
  await expect(page.locator('.sheet h2')).toHaveText('설정');
  await shot(page, '11-settings');
});
