import { test, expect, type Page } from '@playwright/test';

const ADMIN_ROUTES = [
  { path: '/', name: 'dashboard' },
  { path: '/passageiros', name: 'passageiros' },
  { path: '/mensalidades', name: 'mensalidades' },
  { path: '/comunicacao', name: 'comunicacao' },
  { path: '/configuracoes', name: 'configuracoes' },
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

for (const route of ADMIN_ROUTES) {
  test(`admin/${route.name} loads without overflow`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'networkidle', timeout: 15_000 });
    await page.waitForTimeout(1000);

    const info = await getTabInfo(page);
    const truncated = info.tabs.filter((t) => t.truncated);

    expect(info.hasOverflow).toBeFalsy();
    expect(truncated).toHaveLength(0);
  });
}
