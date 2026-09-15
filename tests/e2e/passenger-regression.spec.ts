import { test, expect, type Page } from '@playwright/test';

const PASSENGER_ROUTES = [
  { path: '/', name: 'dashboard' },
  { path: '/minhas-mensalidades', name: 'minhas-mensalidades', hasTabs: true },
  { path: '/minha-disponibilidade', name: 'minha-disponibilidade' },
  { path: '/perfil', name: 'perfil' },
  { path: '/alterar-senha', name: 'alterar-senha' },
];

function getTabInfo(page: Page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const viewWidth = window.innerWidth;
    const tabs: { text: string; truncated: boolean }[] = [];
    document.querySelectorAll('[role="tablist"]').forEach((tc) => {
      tc.querySelectorAll('[role="tab"]').forEach((t) => {
        tabs.push({
          text: t.textContent?.trim() || '',
          truncated: t.scrollWidth > t.clientWidth + 2,
        });
      });
    });
    return { docWidth, viewWidth, hasOverflow: docWidth > viewWidth, tabs };
  });
}

for (const route of PASSENGER_ROUTES) {
  test(`passenger/${route.name} loads without overflow`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'networkidle', timeout: 15_000 });
    await page.waitForTimeout(1000);

    const info = await getTabInfo(page);
    const truncated = info.tabs.filter((t) => t.truncated);

    expect(info.hasOverflow).toBeFalsy();

    if (route.hasTabs) {
      expect(truncated).toHaveLength(0);
      expect(info.tabs.length).toBeGreaterThan(0);
    }
  });
}
