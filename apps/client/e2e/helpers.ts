import { expect, type Page } from '@playwright/test';

export const ROLE_BUTTON = { patient: 'Patient', doctor: 'Doctor', hospital: 'Hospital', lab: 'Laboratory', insurance: 'Insurance', admin: 'Administrator' } as const;
export type Role = keyof typeof ROLE_BUTTON;

/** Signs in with the "Try a demo" button for a role. */
export async function signInAs(page: Page, role: Role) {
  await page.goto('/login');
  await page.locator(`button:has-text("${ROLE_BUTTON[role]}")`).first().click();
  await page.waitForURL(/dashboard/);
  await expect(page.locator('main h1').first()).toBeVisible();
}

/** Collects uncaught page errors so a test can assert there were none. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
