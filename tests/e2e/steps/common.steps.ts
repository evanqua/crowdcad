import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { NAV_TIMEOUT } from '../timeouts';

const { Given, When, Then } = createBdd(test);

Given('I am on the landing page', async ({ page }) => {
  await page.goto('/');
});

Given('I am on the venue selection page', async ({ page }) => {
  await page.goto('/venues/selection');
});

Given('I navigate to {string}', async ({ page }, url: string) => {
  await page.goto(url);
});

When('I click the {string} button', async ({ page }, name: string) => {
  await page.getByRole('button', { name }).first().click();
});

When('I click the {string} link', async ({ page }, name: string) => {
  await page.getByRole('link', { name }).click();
});

When('I click the {string} tab', async ({ page }, name: string) => {
  await page.getByRole('tab', { name }).click();
});

When('I click the {string} menu item', async ({ page }, name: string) => {
  await page.getByRole('menuitem', { name }).click();
});

Then('the URL should be {string}', async ({ page }, url: string) => {
  await expect(page).toHaveURL(url);
});

Then('the URL should contain {string}', async ({ page }, segment: string) => {
  await page.waitForURL(new RegExp(segment.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)), { timeout: NAV_TIMEOUT });
});

Then('the page title should be {string}', async ({ page }, title: string) => {
  await expect(page).toHaveTitle(title);
});

Then('I should see the heading {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('heading', { name })).toBeVisible();
});

Then('I should see a {string} button', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name }).first()).toBeVisible();
});

Then('I should see an {string} button', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name })).toBeVisible();
});

Then('I should see a {string} link', async ({ page }, name: string) => {
  await expect(page.getByRole('link', { name })).toBeVisible();
});

Then('I should see the {string} tab', async ({ page }, name: string) => {
  await expect(page.getByRole('tab', { name })).toBeVisible();
});

Then('I should see the text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).toBeVisible();
});

Then('I should see the logged in user email', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  if (!email) throw new Error('E2E_TEST_EMAIL is not set');
  await expect(page.getByText(email)).toBeVisible();
});

Then('I should not see a {string} button', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name })).not.toBeVisible();
});

Then('I should see the {string} placeholder', async ({ page }, placeholder: string) => {
  await expect(page.getByPlaceholder(placeholder)).toBeVisible();
});

Then('I should see a link {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('link', { name })).toBeVisible();
});

Then('I should not see the text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).not.toBeVisible();
});

When('I fill the {string} placeholder with {string}', async ({ page }, placeholder: string, value: string) => {
  await page.getByPlaceholder(placeholder).fill(value);
});
