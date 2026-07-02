import { test, expect } from '@playwright/test';

test.describe('AI Operations Center Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
  });

  test('should load the dashboard with all major panels', async ({ page }) => {
    // Check if the page contains main sections
    await expect(page.locator('text=AI Operations Center')).toBeVisible();
    await expect(page.locator('text=Agent Execution')).toBeVisible();
    await expect(page.locator('text=Workflow Executions')).toBeVisible();
    await expect(page.locator('text=Document Pipeline')).toBeVisible();
    await expect(page.locator('text=SYSTEM EVENT STREAM')).toBeVisible();
  });

  test('should display initial KPIs', async ({ page }) => {
    // Check if total queries or similar metrics exist
    await expect(page.locator('text=Total Queries')).toBeVisible();
    await expect(page.locator('text=Tokens Used')).toBeVisible();
    await expect(page.locator('text=Avg Latency')).toBeVisible();
  });

  test('should have a working Live/Paused toggle button', async ({ page }) => {
    const liveButton = page.locator('button:has-text("LIVE")');
    await expect(liveButton).toBeVisible();

    // Click to pause
    await liveButton.click();
    await expect(page.locator('button:has-text("PAUSED")')).toBeVisible();

    // Click again to resume
    await page.locator('button:has-text("PAUSED")').click();
    await expect(page.locator('button:has-text("LIVE")')).toBeVisible();
  });
});
