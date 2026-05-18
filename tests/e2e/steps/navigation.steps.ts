import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';

const { Then } = createBdd(test);

Then('the {string} tab should be selected', async ({ page }, name: string) => {
  await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
});
