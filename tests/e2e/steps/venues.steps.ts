import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';

const { Then } = createBdd(test);

Then('I should see the "Venue Selection" or "Your Venues" heading', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: /Venue Selection|Your Venues/ })
  ).toBeVisible();
});

Then('I should see the venue search input', async ({ page }) => {
  await expect(page.getByPlaceholder('Search venues...')).toBeVisible();
});
