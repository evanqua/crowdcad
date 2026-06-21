import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { NAV_TIMEOUT } from '../timeouts';

const { When, Then } = createBdd(test);

// ── Form field assertions ──────────────────────────────────────────────────────

Then('I should see the venue name input', async ({ page }) => {
  await expect(page.getByPlaceholder('e.g., Convention Center Hall A')).toBeVisible();
});

Then('I should see the location name input', async ({ page }) => {
  await expect(page.getByPlaceholder('e.g., Main Entrance')).toBeVisible();
});

Then('I should see the equipment name input', async ({ page }) => {
  await expect(page.getByPlaceholder('e.g., Gurney 1')).toBeVisible();
});

Then('I should see the layer name input', async ({ page }) => {
  await expect(page.getByPlaceholder('Layer name')).toBeVisible();
});

// ── Venue name field interaction ───────────────────────────────────────────────

When('I fill the venue name with {string}', async ({ page }, name: string) => {
  await page.getByPlaceholder('e.g., Convention Center Hall A').fill(name);
});

When('I clear the venue name', async ({ page }) => {
  await page.getByPlaceholder('e.g., Convention Center Hall A').clear();
});

// ── Venue creation with unique name ───────────────────────────────────────────

When('I create a venue with a unique name', async ({ page, scenarioState }) => {
  scenarioState.createdVenueName = `Playwright-Venue-${Date.now()}`;
  await page.getByPlaceholder('e.g., Convention Center Hall A').fill(scenarioState.createdVenueName);
  // Ensure Firebase auth emulator has validated the token before submitting.
  // networkidle settles quickly for /venues/management (no persistent connections).
  await page.waitForLoadState('networkidle', { timeout: 5_000 });
  await page.getByRole('button', { name: 'Create Venue' }).click();
  await page.waitForURL('/venues/selection', { timeout: NAV_TIMEOUT });
});

Then('the newly created venue should be visible', async ({ page, scenarioState }) => {
  await expect(page.getByText(scenarioState.createdVenueName, { exact: true })).toBeVisible();
});

// ── Two-venue search filter scenario ──────────────────────────────────────────

When('I create two venues with unique names', async ({ page, scenarioState }) => {
  const suffix = Date.now();
  scenarioState.createdVenueNameA = `Alpha-${suffix}`;
  scenarioState.createdVenueNameB = `Beta-${suffix}`;

  for (const name of [scenarioState.createdVenueNameA, scenarioState.createdVenueNameB]) {
    await page.goto('/venues/management', { waitUntil: 'networkidle', timeout: 15_000 });
    await page.getByPlaceholder('e.g., Convention Center Hall A').fill(name);
    await page.getByRole('button', { name: 'Create Venue' }).click();
    await page.waitForURL('/venues/selection', { timeout: NAV_TIMEOUT });
  }
});

Then('both created venues should be visible', async ({ page, scenarioState }) => {
  await expect(page.getByText(scenarioState.createdVenueNameA, { exact: true })).toBeVisible();
  await expect(page.getByText(scenarioState.createdVenueNameB, { exact: true })).toBeVisible();
});

When('I search for the first venue', async ({ page, scenarioState }) => {
  await page.getByPlaceholder('Search venues...').fill(scenarioState.createdVenueNameA);
});

Then('only the first venue should be visible', async ({ page, scenarioState }) => {
  await expect(page.getByText(scenarioState.createdVenueNameA, { exact: true })).toBeVisible();
  await expect(page.getByText(scenarioState.createdVenueNameB, { exact: true })).not.toBeVisible();
});

When('I clear the search', async ({ page }) => {
  await page.getByPlaceholder('Search venues...').fill('');
});

When('I search for {string}', async ({ page }, term: string) => {
  await page.getByPlaceholder('Search venues...').fill(term);
});

Then('neither created venue should be visible', async ({ page, scenarioState }) => {
  await expect(page.getByText(scenarioState.createdVenueNameA, { exact: true })).not.toBeVisible();
  await expect(page.getByText(scenarioState.createdVenueNameB, { exact: true })).not.toBeVisible();
});

// ── Location and equipment item addition ───────────────────────────────────────

When('I add a location named {string}', async ({ page }, name: string) => {
  await page.getByPlaceholder('e.g., Main Entrance').fill(name);
  await page.keyboard.press('Enter');
});

When('I add equipment named {string}', async ({ page }, name: string) => {
  await page.getByPlaceholder('e.g., Gurney 1').fill(name);
  await page.keyboard.press('Enter');
});

// Location and equipment deletion — icon-only Trash2 buttons have no aria-label,
// so we locate the card containing the item text and click its danger-colored button.

When('I delete the location {string}', async ({ page }, name: string) => {
  // Each location is in a Card; find the row containing the text and click the last icon button (Trash2)
  const row = page.locator('div.flex.items-center.justify-between', { hasText: name }).first();
  await row.locator('button').last().click();
});

When('I delete the equipment {string}', async ({ page }, name: string) => {
  const row = page.locator('div.flex.items-center.justify-between', { hasText: name }).first();
  await row.locator('button').last().click();
});
