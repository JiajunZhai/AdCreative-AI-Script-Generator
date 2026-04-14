import { test, expect } from '@playwright/test';

const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.zestplay.capybara.defense&hl=en';

test.describe('Core business flow (real network)', () => {
  test('Generator: Play URL -> generate -> export PDF API success', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Generator' }).click();
    await expect(page).toHaveURL(/\/generator$/);

    await page.getByTestId('wizard-store-url').fill(PLAY_URL);
    await page.getByTestId('wizard-sync-store').click();

    await expect(page.getByText('解析完成')).toBeVisible({ timeout: 120_000 });

    await page.getByTestId('wizard-confirm-extract').click();
    await expect(page.getByTestId('wizard-footer-next')).toBeEnabled({ timeout: 15_000 });

    await page.getByTestId('wizard-footer-next').click();
    await page.getByTestId('wizard-footer-next').click();

    const genRespPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/generate') && r.request().method() === 'POST',
      { timeout: 300_000 }
    );
    await page.getByTestId('wizard-generate').click();
    const genResp = await genRespPromise;
    expect(genResp.status()).toBe(200);

    await expect(page.getByRole('heading', { name: /最终生成剧本配置/ })).toBeVisible({
      timeout: 30_000,
    });

    const pdfRespPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/export/pdf') && r.request().method() === 'POST',
      { timeout: 120_000 }
    );
    await page.getByTestId('wizard-export-pdf').click();
    const pdfResp = await pdfRespPromise;
    expect(pdfResp.status()).toBe(200);
    const body = (await pdfResp.json()) as { success?: boolean; pdf_base64?: string };
    expect(body.success).toBeTruthy();
    expect((body.pdf_base64 ?? '').length).toBeGreaterThan(100);
  });
});
