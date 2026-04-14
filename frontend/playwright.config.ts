import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(rootDir, '..', 'backend');

// 若 shell/IDE 误设 CI=1，仍允许复用已运行的 8000/5173，避免 “port already used”
const reuseDevServers =
  process.env.PLAYWRIGHT_FORCE_SPAWN !== '1' && process.env.PLAYWRIGHT_FORCE_SPAWN !== 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  // 真实抓取 + LLM 生成可能远超 4 分钟；全局上限放宽避免误杀
  timeout: 600_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'python -m uvicorn main:app --host 127.0.0.1 --port 8000',
      cwd: backendDir,
      url: 'http://127.0.0.1:8000/',
      reuseExistingServer: reuseDevServers,
      timeout: 120_000,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      cwd: rootDir,
      url: 'http://127.0.0.1:5173/',
      reuseExistingServer: reuseDevServers,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
