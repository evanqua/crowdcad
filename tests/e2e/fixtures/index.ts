import { test as base } from 'playwright-bdd';
import { LandingPage } from '../pages/LandingPage';
import { VenueSelectionPage } from '../pages/VenueSelectionPage';

type Fixtures = {
  landingPage: LandingPage;
  venueSelectionPage: VenueSelectionPage;
  /** Per-scenario scratch space — fresh empty object for each scenario. */
  scenarioState: Record<string, string>;
};

/**
 * Extended test fixture that pre-instantiates Page Object Models.
 *
 * Usage:
 *   import { test, expect } from '../fixtures';
 *   test('my test', async ({ venueSelectionPage }) => { ... });
 */
export const test = base.extend<Fixtures>({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page)); // NOSONAR — `use` is a Playwright fixture callback, not a React hook
  },
  venueSelectionPage: async ({ page }, use) => {
    await use(new VenueSelectionPage(page)); // NOSONAR — `use` is a Playwright fixture callback, not a React hook
  },
  scenarioState: async ({}, use) => {
    await use({}); // NOSONAR — `use` is a Playwright fixture callback, not a React hook
  },
});

export { expect } from '@playwright/test';
