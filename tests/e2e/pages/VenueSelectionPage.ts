import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for /venues/selection.
 *
 * selection/page.tsx renders different headings for mobile and desktop:
 * - Desktop (≥768px): "Venue Selection"
 * - Mobile (<768px):  "Your Venues"
 */
export class VenueSelectionPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly newVenueButton: Locator;
  readonly venueSearchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /Venue Selection|Your Venues/ });
    this.newVenueButton = page.getByRole('button', { name: 'New Venue' });
    this.venueSearchInput = page.getByPlaceholder('Search venues...');
  }

  async goto() {
    await this.page.goto('/venues/selection');
  }

  async searchVenue(query: string) {
    await this.venueSearchInput.fill(query);
  }

  async clickNewVenue() {
    await this.newVenueButton.click();
    await this.page.waitForURL('/venues/management');
  }
}
