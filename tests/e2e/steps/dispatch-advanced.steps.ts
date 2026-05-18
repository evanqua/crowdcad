import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { NAV_TIMEOUT } from '../timeouts';

const { Given, When, Then } = createBdd(test);

Given('I have a venue with location {string} and equipment {string} and am on the dispatch page', async ({ page }, location: string, equipment: string) => {
  const venueName = `AdvVenue-${Date.now()}`;

  await page.goto('/venues/management', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
  await page.getByPlaceholder('e.g., Convention Center Hall A').fill(venueName);

  // Add location on Locations tab (default active)
  await page.getByPlaceholder('e.g., Main Entrance').fill(location);
  await page.keyboard.press('Enter');

  // Switch to Equipment tab and add equipment
  await page.getByRole('tab', { name: 'Equipment' }).click();
  await page.getByPlaceholder('e.g., Gurney 1').fill(equipment);
  await page.keyboard.press('Enter');

  // Create venue and navigate to selection
  await page.getByRole('button', { name: 'Create Venue' }).click();
  await page.waitForURL('/venues/selection', { timeout: NAV_TIMEOUT });
  const venueLink = page.getByText(venueName, { exact: true });
  await expect(venueLink).toBeVisible();
  await venueLink.click();
  await page.getByRole('button', { name: 'Start New Event' }).click();
  await page.waitForURL(/\/events\/.*\/create/, { timeout: NAV_TIMEOUT });

  await page.getByPlaceholder('Enter event name').fill(`Adv Event ${Date.now()}`);
  await page.getByRole('button', { name: 'Create Event' }).click();
  await page.waitForURL(/\/events\/.*\/dispatch/, { timeout: NAV_TIMEOUT });
  await page.locator('[aria-label="Select section"]').waitFor({ state: 'visible', timeout: 20_000 });
});

When('I change equipment {string} status to {string}', async ({ page }, equipName: string, newStatus: string) => {
  const card = page.getByTestId(`equipment-card-${equipName}`);
  await card.locator('[aria-label="Status"]').click();
  await page.locator('[role="listbox"]').getByText(newStatus, { exact: true }).click();
});

Then('the equipment {string} should show status {string}', async ({ page }, equipName: string, status: string) => {
  const card = page.getByTestId(`equipment-card-${equipName}`);
  // HeroUI Select renders two [data-slot="value"] spans per Select (trigger + hidden a11y copy);
  // .first() targets the visible trigger span
  await expect(card.locator('[aria-label="Status"] [data-slot="value"]').first()).toHaveText(status);
});
