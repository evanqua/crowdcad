import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { NAV_TIMEOUT } from '../timeouts';
import { uniqueSuffix } from '../helpers/unique';

const { Given } = createBdd(test);

Given('I have created an event with posts enabled and am on the dispatch page', async ({ page }) => {
  const venueName = `PostSched-Venue-${uniqueSuffix()}`;
  await page.goto('/venues/management', { timeout: NAV_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => {});
  await page.getByPlaceholder('e.g., Convention Center Hall A').fill(venueName);
  await page.getByRole('button', { name: /^Review:/ }).click();
  await page.getByRole('button', { name: 'Create Venue' }).click();
  await page.waitForURL('/venues/selection', { timeout: NAV_TIMEOUT });

  const venueLink = page.getByText(venueName, { exact: true });
  await expect(venueLink).toBeVisible();
  await venueLink.click();
  await page.getByRole('button', { name: 'Start New Event' }).click();
  await page.waitForURL(/\/events\/.*\/create/, { timeout: 10_000 });

  const eventName = `PostSched-Event-${uniqueSuffix()}`;
  await page.getByPlaceholder('Enter event name').fill(eventName);

  // Enable posts so a posting schedule gets generated — the Posting
  // Schedule nav item only appears once postingTimes is actually
  // non-empty. Targets the checkbox role itself, not its label text: the
  // label's <span> is what getByText finds, but HeroUI's real (invisible,
  // absolutely-positioned, full-size) <input type="checkbox"> sits on top
  // of it and intercepts the click, so clicking the text directly just
  // spins retrying against an element something else is covering.
  await page.getByRole('button', { name: /^Post schedule:/ }).click();
  await page.getByRole('checkbox', { name: 'Enable Posts' }).click();

  await page.getByRole('button', { name: /^Review:/ }).click();
  await page.getByRole('button', { name: 'Create Event' }).click();
  await page.waitForURL(/\/events\/.*\/dispatch/, { timeout: NAV_TIMEOUT });
  await page.locator('[aria-label="Select section"]').waitFor({ state: 'visible', timeout: 20_000 });
});
