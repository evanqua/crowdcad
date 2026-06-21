import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { NAV_TIMEOUT } from '../timeouts';

const { Given, When, Then } = createBdd(test);

Given('I have created an event and am on the dispatch page', async ({ page }) => {
  // networkidle ensures the Firebase Auth emulator token-validation (and any
  // initial Firestore calls) complete before we interact with the form.
  const venueName = `Dispatch-Venue-${Date.now()}`;
  await page.goto('/venues/management', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
  await page.getByPlaceholder('e.g., Convention Center Hall A').fill(venueName);
  await page.getByRole('button', { name: 'Create Venue' }).click();
  await page.waitForURL('/venues/selection', { timeout: NAV_TIMEOUT });

  // Select the venue and start a new event
  const venueLink = page.getByText(venueName, { exact: true });
  await expect(venueLink).toBeVisible();
  await venueLink.click();
  await page.getByRole('button', { name: 'Start New Event' }).click();
  await page.waitForURL(/\/events\/.*\/create/, { timeout: 10_000 });

  // Name and launch the event (auth.currentUser stays set across SPA navigation)
  const eventName = `Test Event ${Date.now()}`;
  await page.getByPlaceholder('Enter event name').fill(eventName);
  await page.getByRole('button', { name: 'Create Event' }).click();
  await page.waitForURL(/\/events\/.*\/dispatch/, { timeout: NAV_TIMEOUT });
  // Wait for the dispatch page to hydrate before asserting
  await page.locator('[aria-label="Select section"]').waitFor({ state: 'visible', timeout: 20_000 });
});

Then('I should see the teams section', async ({ page }) => {
  // The left sidebar defaults to "Teams" view; with no teams added, this message shows
  await expect(page.getByText('No teams available')).toBeVisible();
});

When('I open the quick call modal', async ({ page }) => {
  await page.getByTestId('add-call-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

When('I log a call with location {string} and complaint {string}', async ({ page, scenarioState }, location: string, complaint: string) => {
  scenarioState.loggedCallLocation = location;
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Location').fill(location);
  await dialog.getByLabel('Chief Complaint').fill(complaint);
  await dialog.getByRole('button', { name: 'Submit' }).click();
});

Then('the call should appear in the call list', async ({ page, scenarioState }) => {
  await expect(page.getByText(scenarioState.loggedCallLocation)).toBeVisible();
});

// Team management

When('I open the add team modal', async ({ page }) => {
  // Two buttons share this aria-label (condensed header + Staff tab); .first() picks either
  await page.getByRole('button', { name: 'Add Team or Supervisor' }).first().click();
  await page.getByRole('menuitem', { name: 'Add Team' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

When('I create a team named {string} with a member {string} certified as {string}', async ({ page }, teamName: string, memberName: string, cert: string) => {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Team name').fill(teamName);
  await dialog.getByLabel('Member name').fill(memberName);
  await dialog.locator('[aria-label="Certification"]').click();
  // HeroUI SelectItem's aria-label lands on an inner wrapper, leaving the <li role="option">
  // with no accessible name — use getByText within the listbox instead
  await page.locator('[role="listbox"]').getByText(cert, { exact: true }).click();
  await dialog.getByRole('button', { name: 'Add member' }).click();
  await dialog.getByRole('button', { name: 'Create Team' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

Then('the team {string} should appear in the teams list', async ({ page }, teamName: string) => {
  // Team name can appear in multiple panels (condensed view + Staff tab); .first() is sufficient
  await expect(page.getByText(teamName).first()).toBeVisible();
});

Then('the team {string} should have status {string}', async ({ page }, teamName: string, status: string) => {
  const card = page.getByTestId(`team-card-${teamName}`);
  // HeroUI Select renders two [data-slot="value"] spans per Select (trigger + hidden a11y copy);
  // .first() targets the visible trigger span
  await expect(card.locator('[aria-label="Status"] [data-slot="value"]').first()).toHaveText(status);
});

// Call with team assignment

When('I log a call assigned to team {string} at location {string} with complaint {string}', async ({ page, scenarioState }, teamName: string, location: string, complaint: string) => {
  scenarioState.loggedCallLocation = location;
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Location').fill(location);
  await dialog.getByLabel('Chief Complaint').fill(complaint);
  await dialog.locator('[aria-label="Assign Team"]').click();
  // Option text is "{teamName} - {location}" — match by partial text to handle any location suffix
  await page.locator('[role="listbox"]').getByText(teamName).click();
  await dialog.getByRole('button', { name: 'Submit' }).click();
});

// Quick call modal cancel

When('I fill the quick call location with {string}', async ({ page }, text: string) => {
  await page.getByRole('dialog').getByLabel('Location').fill(text);
});

When('I cancel the quick call modal', async ({ page }) => {
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
});

Then('the quick call location field should be empty', async ({ page }) => {
  await expect(page.getByRole('dialog').getByLabel('Location')).toHaveValue('');
});

// End event modal

When('I open the end event modal', async ({ page }) => {
  await page.getByRole('button', { name: 'End Event' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

When('I close the end event modal', async ({ page }) => {
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
});

Then('the end event modal should be closed', async ({ page }) => {
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
});

// Section switching

When('I switch to the {string} section', async ({ page }, section: string) => {
  // "Clinic", "Calls", and "Staff" are bottom-bar tabs in the mobile layout (lg:hidden).
  // On desktop viewports the mobile tab bar is hidden and these sections are always visible,
  // so clicking a non-existent tab would time out. Only click the tab when it is visible.
  // "Teams", "Supervisors", "Equipment" live in the left-panel Select dropdown on desktop.
  const bottomTabs = ['Staff', 'Calls', 'Clinic'];
  if (bottomTabs.includes(section)) {
    const tab = page.getByRole('tab', { name: section });
    if (await tab.isVisible()) {
      await tab.click();
    }
    // else: desktop layout — section is always visible without a tab to click
  } else {
    await page.locator('[aria-label="Select section"]').click();
    await page.getByRole('option', { name: section }).click();
  }
});

// Supervisor management

When('I open the add supervisor modal', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Team or Supervisor' }).first().click();
  await page.getByRole('menuitem', { name: 'Add Supervisor' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

When('I create a supervisor with call sign {string} and certification {string}', async ({ page }, callSign: string, cert: string) => {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Supervisor Call Sign').fill(callSign);
  await dialog.locator('[aria-label="Certification"]').click();
  await page.locator('[role="listbox"]').getByText(cert, { exact: true }).click();
  await dialog.getByRole('button', { name: 'Create Supervisor' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

Then('the supervisor {string} should appear in the supervisors list', async ({ page }, callSign: string) => {
  // Call sign appears in both the condensed panel and the Staff tab panel; .first() is sufficient
  await expect(page.getByText(callSign).first()).toBeVisible();
});

// Team status changes within a call

When('I change team {string} status on the call to {string}', async ({ page }, teamName: string, newStatus: string) => {
  await page.getByTestId(`team-chip-${teamName}`).locator('button').first().click();
  await page.getByRole('menuitem', { name: newStatus }).click();
});

// End event Continue button state

Then('the end event continue button should be disabled', async ({ page }) => {
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Continue' })
  ).toBeDisabled({ timeout: 5_000 });
});

When('I select the {string} option', async ({ page }, option: string) => {
  await page.getByRole('dialog').getByRole('checkbox', { name: option }).click();
});

Then('the end event continue button should be enabled', async ({ page }) => {
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Continue' })
  ).toBeEnabled({ timeout: 5_000 });
});

// Team deletion

When('I delete the team {string}', async ({ page }, teamName: string) => {
  const card = page.getByTestId(`team-card-${teamName}`);
  await card.getByRole('button', { name: 'Team actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
});

Then('the team {string} should not be visible', async ({ page }, teamName: string) => {
  await expect(page.getByText(teamName).first()).not.toBeVisible({ timeout: 5_000 });
});

// Supervisor deletion

When('I delete the supervisor {string}', async ({ page }, callSign: string) => {
  // Supervisors render via TeamWidget with the same data-testid pattern as teams
  const card = page.getByTestId(`team-card-${callSign}`);
  await card.getByRole('button', { name: 'Team actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
});

// End event continue button

When('I click the end event continue button', async ({ page }) => {
  await page.getByRole('dialog').getByRole('button', { name: 'Continue' }).click();
});
