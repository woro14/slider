import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Use a preinstalled Chromium when one is provided (e.g. CI images).
const executablePath = process.env.CHROMIUM_PATH
  ?? ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => existsSync(p))

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3123',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: executablePath ? { executablePath } : {} } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: executablePath ? { executablePath } : {} } },
  ],
  webServer: {
    command: 'PORT=3123 node playground/.output/server/index.mjs',
    port: 3123,
    reuseExistingServer: true,
  },
})
