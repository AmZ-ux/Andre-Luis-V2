import { test as setup, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'toinzim838@gmail.com';
const ADMIN_PASS = process.env.E2E_ADMIN_PASS || 'Admin@123456!';
const PASSENGER_EMAIL = process.env.E2E_PASSENGER_EMAIL || 'antonio@transportes.com';
const PASSENGER_PASS = process.env.E2E_PASSENGER_PASS || 'Admin@123456!';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 15_000 });
  await page.waitForTimeout(1000);
  await page.fill('#email-ou-cpf', ADMIN_EMAIL);
  await page.fill('#senha', ADMIN_PASS);
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
  } catch { /* continue */ }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  expect(page.url()).not.toContain('/login');
  await page.context().storageState({ path: 'test-results/.admin-auth.json' });
});

setup('authenticate as passenger', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 15_000 });
  await page.waitForTimeout(1000);
  await page.fill('#email-ou-cpf', PASSENGER_EMAIL);
  await page.fill('#senha', PASSENGER_PASS);
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
  } catch { /* continue */ }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  expect(page.url()).not.toContain('/login');
  await page.context().storageState({ path: 'test-results/.passenger-auth.json' });
});
