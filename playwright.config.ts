import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.E2E_PORT || 3003);

function loadServerEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const raw = readFileSync(resolve(__dirname, 'server/.env'), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
  } catch { /* server .env not found */ }
  return env;
}

const serverEnv = loadServerEnv();

const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
];

const viewportProjects = VIEWPORTS.flatMap((vp) => [
  {
    name: `admin-${vp.name}`,
    testMatch: /admin-regression/,
    use: {
      viewport: { width: vp.width, height: vp.height },
      storageState: 'test-results/.admin-auth.json',
    },
    dependencies: ['setup'],
  },
  {
    name: `passenger-${vp.name}`,
    testMatch: /passenger-regression/,
    use: {
      viewport: { width: vp.width, height: vp.height },
      storageState: 'test-results/.passenger-auth.json',
    },
    dependencies: ['setup'],
  },
]);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    screenshot: 'off',
    trace: 'off',
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: 'npx.cmd tsx src/index.ts',
    cwd: resolve(__dirname, 'server'),
    port: PORT,
    timeout: 30_000,
    reuseExistingServer: false,
    env: {
      ...serverEnv,
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts$/,
    },
    ...viewportProjects,
  ],
});
