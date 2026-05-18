import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';

const { When, Then } = createBdd(test);

// ── Modal visibility ───────────────────────────────────────────────────────────

Then('the login modal should be visible', async ({ page }) => {
  await expect(page.getByRole('dialog')).toBeVisible();
});

Then('the login modal should not be visible', async ({ page }) => {
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

Then('the login modal should have the title {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('dialog')).toHaveAccessibleName(title);
});

// ── Fields inside the modal ────────────────────────────────────────────────────

Then('the {string} field should be visible in the modal', async ({ page }, label: string) => {
  await expect(page.getByRole('dialog').getByLabel(label)).toBeVisible();
});

Then('the {string} field should not be visible in the modal', async ({ page }, label: string) => {
  await expect(page.getByRole('dialog').getByLabel(label)).not.toBeVisible();
});

When('I fill the {string} field with {string}', async ({ page }, label: string, value: string) => {
  await page.getByRole('dialog').getByLabel(label, { exact: true }).fill(value);
});

When('I clear the {string} field', async ({ page }, label: string) => {
  await page.getByRole('dialog').getByLabel(label, { exact: true }).clear();
});

// ── Buttons inside the modal ───────────────────────────────────────────────────

Then('I should see a {string} button in the modal', async ({ page }, name: string) => {
  await expect(page.getByRole('dialog').getByRole('button', { name })).toBeVisible();
});

Then('I should see a {string} submit button in the modal', async ({ page }, name: string) => {
  await expect(
    page.getByRole('dialog').getByRole('button', { name, exact: true })
  ).toBeVisible();
});

When('I click the {string} button in the modal', async ({ page }, name: string) => {
  await page.getByRole('dialog').getByRole('button', { name }).click();
});

When('I click the {string} submit button', async ({ page }, name: string) => {
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
});

Then('the {string} submit button should be disabled', async ({ page }, name: string) => {
  await expect(
    page.getByRole('dialog').getByRole('button', { name, exact: true })
  ).toBeDisabled();
});

Then('the {string} submit button should be enabled', async ({ page }, name: string) => {
  await expect(
    page.getByRole('dialog').getByRole('button', { name, exact: true })
  ).toBeEnabled();
});

Then('the {string} button should be disabled', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
});

Then('the {string} button should be enabled', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name, exact: true })).toBeEnabled();
});

// ── Text and errors inside the modal ──────────────────────────────────────────

Then('I should see the modal text {string}', async ({ page }, text: string) => {
  await expect(page.getByRole('dialog').getByText(text)).toBeVisible();
});

Then('I should see the modal error {string}', async ({ page }, error: string) => {
  // NOTE: loginmodal.tsx renders errors as a plain <p> with no role="alert".
  // This step is therefore identical to `modal text` — add role="alert" to the
  // error element in the component to make this assertion meaningful.
  await expect(page.getByRole('dialog').getByText(error)).toBeVisible();
});

// Steps for successful login/signup using real emulator credentials

When('I fill the {string} field with the test user email', async ({ page }, label: string) => {
  const email = process.env.E2E_TEST_EMAIL;
  if (!email) throw new Error('E2E_TEST_EMAIL not set');
  await page.getByRole('dialog').getByLabel(label, { exact: true }).fill(email);
});

When('I fill the {string} field with the test user password', async ({ page }, label: string) => {
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) throw new Error('E2E_TEST_PASSWORD not set');
  await page.getByRole('dialog').getByLabel(label, { exact: true }).fill(password);
});

When('I fill the {string} field with a unique signup email', async ({ page }, label: string) => {
  const uniqueEmail = `e2e-signup-${Date.now()}@crowdcad.test`;
  await page.getByRole('dialog').getByLabel(label, { exact: true }).fill(uniqueEmail);
});
