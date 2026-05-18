import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';

const { Given } = createBdd(test);

Given('the profile page is loaded', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'Account' })).toBeVisible();
});
