import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { UPLOAD_TIMEOUT } from '../timeouts';
import path from 'node:path';

const { When, Then } = createBdd(test);

// ── Map image upload ───────────────────────────────────────────────────────────

When('I upload the venue map image {string}', async ({ page }, filename: string) => {
  const filePath = path.join(__dirname, '..', filename);
  await page.getByTestId('map-file-input').setInputFiles(filePath);
});

Then('the venue map should be displayed', async ({ page }) => {
  await expect(page.getByAltText('Venue map')).toBeVisible({ timeout: 5_000 });
});

// ── Add Markers mode ───────────────────────────────────────────────────────────

When('I enable Add Markers mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Markers' }).click();
});

When('I click on the center of the venue map', async ({ page }) => {
  const mapImage = page.getByAltText('Venue map');
  const box = await mapImage.boundingBox();
  if (!box) throw new Error('Venue map image bounding box not found');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
});

When('I name the marker {string}', async ({ page }, name: string) => {
  await page.getByPlaceholder('Location name').fill(name);
  await page.getByRole('button', { name: 'Confirm' }).click();
});

// ── New layer modal ────────────────────────────────────────────────────────────

When('I open the add layer modal', async ({ page }) => {
  await page.getByTestId('add-layer-button').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
});

When('I fill the layer name with {string}', async ({ page }, name: string) => {
  // The modal's input has aria-label="Layer name" but no placeholder attribute.
  // The page's layer-name input also has aria-label="Layer name" AND placeholder="Layer name".
  // :not([placeholder]) ensures we only match the modal's input.
  await page.locator('[aria-label="Layer name"]:not([placeholder])').fill(name);
});

When('I upload the layer map image {string}', async ({ page }, filename: string) => {
  const filePath = path.join(__dirname, '..', filename);
  await page.getByTestId('layer-file-input').setInputFiles(filePath);
});

When('I confirm adding the layer', async ({ page }) => {
  // Click the "Add Layer" submit button inside the modal (enabled only when
  // both a name and a file have been provided).
  await page.getByRole('dialog').getByRole('button', { name: 'Add Layer' }).click();
  // Wait for Firebase Storage upload + modal close
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: UPLOAD_TIMEOUT });
});

Then('I should see the layer named {string}', async ({ page }, name: string) => {
  // After the new layer is added it becomes active; its name is reflected in the
  // layer name input at the top of the right panel.
  await expect(page.getByPlaceholder('Layer name')).toHaveValue(name, { timeout: UPLOAD_TIMEOUT });
});

// ── Layer name inline editing ──────────────────────────────────────────────────

When('I clear the layer name and type {string}', async ({ page }, name: string) => {
  const input = page.getByPlaceholder('Layer name');
  await input.clear();
  await input.fill(name);
});

Then('the layer name input should show {string}', async ({ page }, name: string) => {
  await expect(page.getByPlaceholder('Layer name')).toHaveValue(name);
});
