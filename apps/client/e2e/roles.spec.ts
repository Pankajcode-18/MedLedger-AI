import { test, expect } from '@playwright/test';
import { signInAs, watchErrors, type Role } from './helpers';

/** Every workspace page opens for its role, shows a title and raises no errors. */
const PAGES: Record<Role, string[]> = {
  patient: ['/patient/dashboard', '/patient/records', '/patient/analytics?tab=charts', '/patient/analytics?tab=reports', '/patient/permissions', '/patient/activity', '/patient/notifications', '/patient/settings'],
  doctor: ['/doctor/dashboard', '/doctor/patients', '/doctor/records', '/doctor/requests', '/doctor/ai', '/doctor/medications', '/doctor/activity', '/doctor/settings'],
  hospital: ['/hospital/dashboard', '/hospital/patients', '/hospital/staff', '/hospital/admissions', '/hospital/records', '/hospital/prescriptions', '/hospital/activity', '/hospital/settings'],
  lab: ['/lab/dashboard', '/lab/samples', '/lab/reports', '/lab/upload', '/lab/verify', '/lab/activity', '/lab/settings'],
  insurance: ['/insurance/dashboard', '/insurance/claims', '/insurance/pending', '/insurance/policyholders', '/insurance/verify', '/insurance/activity', '/insurance/settings'],
  admin: ['/admin/dashboard', '/admin/users', '/admin/orgs', '/admin/permissions', '/admin/blockchain', '/admin/security', '/admin/activity', '/admin/settings']
};

for (const role of Object.keys(PAGES) as Role[]) {
  test(`${role}: every page opens`, async ({ page }) => {
    const errors = watchErrors(page);
    await signInAs(page, role);
    for (const path of PAGES[role]) {
      await page.goto(path);
      await expect(page.locator('main h1').first(), path).toBeVisible();
      await expect(page.locator('main'), path).not.toContainText(/Something went wrong|Error 40\d|Error 50\d/);
    }
    expect(errors).toEqual([]);
  });

  test(`${role}: cannot open another role's pages`, async ({ page }) => {
    await signInAs(page, role);
    const other = role === 'patient' ? '/doctor/dashboard' : '/patient/dashboard';
    if (role === 'admin') return; // administrators may look everywhere
    await page.goto(other);
    await expect(page).not.toHaveURL(new RegExp(other));
  });
}

test('signing out ends the session', async ({ page }) => {
  await signInAs(page, 'patient');
  await page.evaluate(() => localStorage.removeItem('medledger_token'));
  await page.goto('/patient/dashboard');
  await expect(page).toHaveURL(/login/);
});
