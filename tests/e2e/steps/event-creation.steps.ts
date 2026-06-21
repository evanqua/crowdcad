import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { NAV_TIMEOUT } from '../timeouts';

const { Given, When } = createBdd(test);

Given('I have a venue ready for event creation', async ({ page, scenarioState }) => {
  scenarioState.eventVenueName = `EC-Venue-${Date.now()}`;
  await page.goto('/venues/management', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
  await page.getByPlaceholder('e.g., Convention Center Hall A').fill(scenarioState.eventVenueName);
  await page.getByRole('button', { name: 'Create Venue' }).click();
  await page.waitForURL('/venues/selection', { timeout: NAV_TIMEOUT });
});

Given('I have started a new draft event from that venue', async ({ page, scenarioState }) => {
  const venueLink = page.getByText(scenarioState.eventVenueName, { exact: true });
  await expect(venueLink).toBeVisible();
  await venueLink.click();
  await page.getByRole('button', { name: 'Start New Event' }).click();
  await page.waitForURL(/\/events\/.*\/create/, { timeout: 10_000 });
  // Wait for React to hydrate before interacting with the form
  await page.getByPlaceholder('Enter event name').waitFor({ state: 'visible', timeout: 10_000 });
});

When('I fill the event name with {string}', async ({ page }, name: string) => {
  await page.getByPlaceholder('Enter event name').fill(name);
});

When('I click the add team button', async ({ page }) => {
  await page.getByTestId('add-team-button').click();
});

When('I select {string} from the {string} dropdown', async ({ page }, option: string, label: string) => {
  await page.getByRole('dialog').locator(`[aria-label="${label}"]`).click();
  // Wait for the HeroUI listbox portal to appear before clicking the option
  await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('[role="option"]', { hasText: option }).first().click();
});

// Supervisor management on the event creation page

When('I click the add event supervisor button', async ({ page }) => {
  // The icon-only Plus button has aria-label="Add Supervisor" in the Supervisors tab panel
  await page.getByLabel('Add Supervisor').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

When('I fill the supervisor call sign with {string}', async ({ page }, callSign: string) => {
  await page.getByRole('dialog').getByLabel('Supervisor Call Sign').fill(callSign);
});

When('I select event supervisor certification {string}', async ({ page }, cert: string) => {
  await page.getByRole('dialog').locator('[aria-label="Certification"]').click();
  await page.locator('[role="listbox"]').getByText(cert, { exact: true }).click();
});
