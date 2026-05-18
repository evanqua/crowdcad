import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { NAV_TIMEOUT } from '../timeouts';

const { Given, When, Then } = createBdd(test);

/**
 * Background step: creates a venue, starts an event, adds a team, logs a call
 * through the full lifecycle (En Route → Transporting → Delivered), then ends
 * the event with "Quick summary" to navigate to the summary page.
 */
Given('I have ended an event and am on the summary page', async ({ page }) => {
  // 1. Create a venue
  const venueName = `Summary-Venue-${Date.now()}`;
  await page.goto('/venues/management', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
  await page.getByPlaceholder('e.g., Convention Center Hall A').fill(venueName);
  await page.getByRole('button', { name: 'Create Venue' }).click();
  await page.waitForURL('/venues/selection', { timeout: NAV_TIMEOUT });

  // 2. Select venue and start event
  await page.getByText(venueName, { exact: true }).click();
  await page.getByRole('button', { name: 'Start New Event' }).click();
  await page.waitForURL(/\/events\/.*\/create/, { timeout: 10_000 });

  // 3. Name and launch the event
  await page.getByPlaceholder('Enter event name').fill(`Summary Event ${Date.now()}`);
  await page.getByRole('button', { name: 'Create Event' }).click();
  await page.waitForURL(/\/events\/.*\/dispatch/, { timeout: NAV_TIMEOUT });
  await page.locator('[aria-label="Select section"]').waitFor({ state: 'visible', timeout: 10_000 });

  // 4. Add a team
  await page.getByRole('button', { name: 'Add Team or Supervisor' }).first().click();
  await page.getByRole('menuitem', { name: 'Add Team' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Team name').fill('SummaryTeam');
  await dialog.getByLabel('Member name').fill('Test User');
  await dialog.locator('[aria-label="Certification"]').click();
  await page.locator('[role="listbox"]').getByText('FA', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Add member' }).click();
  await dialog.getByRole('button', { name: 'Create Team' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // 5. Log a call assigned to the team
  await page.getByTestId('add-call-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const callDialog = page.getByRole('dialog');
  await callDialog.getByLabel('Location').fill('Main Stage');
  await callDialog.getByLabel('Chief Complaint').fill('Test Complaint');
  await callDialog.locator('[aria-label="Assign Team"]').click();
  await page.locator('[role="listbox"]').getByText('SummaryTeam').click();
  await callDialog.getByRole('button', { name: 'Submit' }).click();

  // 6. Progress through call lifecycle: En Route → Transporting → Delivered
  await page.getByTestId('team-chip-SummaryTeam').locator('button').first().click();
  await page.getByRole('menuitem', { name: 'Transporting' }).click();
  await page.getByTestId('team-chip-SummaryTeam').locator('button').first().click();
  await page.getByRole('menuitem', { name: 'Delivered' }).click();

  // 7. End event with quick summary
  await page.getByRole('button', { name: 'End Event' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Quick summary' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(/\/events\/.*\/summary/, { timeout: NAV_TIMEOUT });
});

// Staff Logs toggle
When('I click the staff logs show button', async ({ page }) => {
  // "Staff Logs" is in a <span> inside a <div>; go up two levels to reach the
  // flex container that also holds the Show button as a sibling div's child.
  const staffSection = page.locator('text=Staff Logs').locator('../..');
  await staffSection.getByRole('button', { name: 'Show' }).click();
});

Then('I should see staff log entries', async ({ page }) => {
  // After expanding, we should see team name "SummaryTeam" in the staff logs.
  // Use the heading (h4) to avoid a strict-mode violation with the nav span that
  // also contains the team name.
  await expect(page.getByRole('heading', { name: 'SummaryTeam' })).toBeVisible();
});

// Call Logs toggle
When('I click the call logs show button', async ({ page }) => {
  const callSection = page.locator('text=Call Logs').locator('../..');
  await callSection.getByRole('button', { name: 'Show' }).click();
});

Then('I should see call log entries', async ({ page }) => {
  // After expanding, we should see the complaint in the call header.
  // Use exact match on the heading div to avoid a strict-mode violation with the
  // log-entry line that also contains the complaint text.
  await expect(page.getByText('Call #1 — Test Complaint', { exact: true })).toBeVisible();
});

// CSV download — set up the listener before clicking to avoid a race condition
Then('clicking {string} should trigger a CSV download', async ({ page }, buttonName: string) => {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10_000 }),
    page.getByRole('button', { name: buttonName }).click(),
  ]);
  expect(download.suggestedFilename()).toContain('_Summary.csv');
});
