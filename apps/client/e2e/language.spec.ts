import { test, expect } from '@playwright/test';
import { signInAs } from './helpers';

const picker = '[aria-label="Language / भाषा"]';

test('switching between English, Nepali and Hindi', async ({ page }) => {
  await page.goto('/');
  await page.locator(picker).first().selectOption('ne');
  await expect(page.locator('body')).toContainText('साइन इन');
  await page.locator(picker).first().selectOption('en');
  await signInAs(page, 'patient');
  await page.locator(`header ${picker}`).selectOption('ne');
  await expect(page.locator('main h1').first()).toContainText('गृहपृष्ठ');
  await page.locator(`header ${picker}`).selectOption('hi');
  await expect(page.locator('main h1').first()).toContainText('होम');
  await page.reload();
  await expect(page.locator('main h1').first()).toContainText('होम');
  await page.goto('/patient/permissions');
  await expect(page.locator('main')).not.toContainText('You decide who sees your records');
  await page.locator(`header ${picker}`).selectOption('en');
  await expect(page.locator('main')).toContainText('You decide who sees your records');
});

test('on a phone the page fits and buttons are easy to tap', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true })).newPage();
  await signInAs(page, 'patient');
  for (const path of ['/patient/dashboard', '/patient/records', '/patient/permissions']) {
    await page.goto(path);
    await expect(page.locator('main h1').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), path).toBe(true);
    const small = await page.$$eval('main button', (els) => els.filter((e) => (e as HTMLElement).offsetParent && e.getBoundingClientRect().height < 44).length);
    expect(small, path).toBe(0);
  }
});
