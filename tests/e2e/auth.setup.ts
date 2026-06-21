import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Path must match STORAGE_STATE in playwright.config.ts
const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Auth setup: logs in via the UI and saves the browser context (cookies +
 * localStorage, which contains the Firebase ID token) to disk.
 *
 * Every test in the 'chromium' project starts with a copy of this context,
 * so Firebase auth state is already restored — no login needed per test.
 */
setup('authenticate and save storage state', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in .env.test.local'
    );
  }

  await page.goto('/');

  // The landing page shows a "Sign In" button when logged out (page.tsx)
  await page.getByRole('button', { name: 'Sign In' }).first().click();

  // LoginModal opens — fill in credentials
  // loginmodal.tsx uses label="Email Address" and label="Password" on HeroUI Inputs
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);

  // The submit button inside the modal says "Login" (loginmodal.tsx line 234)
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  // Wait for the modal to close — loginmodal.tsx calls onClose() after successful login
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });

  // Verify the ccad_auth cookie was set by useauth.ts
  await expect(async () => {
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === 'ccad_auth' && c.value === '1');
    expect(authCookie).toBeDefined();
  }).toPass({ timeout: 5_000 });

  // Save full context: cookies + localStorage (Firebase token lives in localStorage)
  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
