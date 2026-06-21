import { createBdd } from 'playwright-bdd';
import { test } from '../fixtures';

const { When } = createBdd(test);

/**
 * Sets the clinic outcome for the most recent call in the clinic tracking table.
 * The clinic table shows a status dropdown button (default text "In Clinic") for
 * each unresolved call. This step clicks the first such button and selects the
 * requested outcome from the dropdown menu.
 */
When('I set the clinic outcome for the latest call to {string}', async ({ page }, outcome: string) => {
  // The clinic tracking table (desktop) renders a Button whose only text content is
  // "In Clinic" (no aria-label), so exact: true matches it without also matching the
  // team-card status button (which renders "Status\nIn Cl…" via two nested divs).
  const statusButton = page.getByRole('button', { name: 'In Clinic', exact: true }).first();
  await statusButton.click();
  // Select the outcome from the dropdown
  await page.getByRole('menuitem', { name: outcome }).click();
  // After setting an outcome the call moves to the resolved section (hidden by default).
  // Toggle "Show Resolved Clinic Calls" so the outcome text becomes visible.
  await page.getByLabel('Toggle resolved clinic calls').first().click();
});
