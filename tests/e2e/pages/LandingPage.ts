import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for the landing page (/).
 *
 * Centralises all selectors so that DOM changes only require updates here,
 * not in every test that touches the landing page.
 */
export class LandingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInButton: Locator;
  readonly startNewEventButton: Locator;
  readonly loginModal: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly modalSubmitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // page.tsx: <h1>Welcome back to CrowdCAD</h1>
    this.heading = page.getByRole('heading', { name: 'Welcome back to CrowdCAD' });
    // Shown when user is not logged in
    this.signInButton = page.getByRole('button', { name: 'Sign In' }).first();
    // Shown when user is logged in
    this.startNewEventButton = page.getByRole('button', { name: 'Start a New Event' });
    // HeroUI Modal renders as role="dialog"
    this.loginModal = page.getByRole('dialog');
    // loginmodal.tsx: label="Email Address"
    this.emailInput = page.getByLabel('Email Address');
    // loginmodal.tsx: label="Password"
    this.passwordInput = page.getByLabel('Password');
    // The submit button inside the modal (last "Sign In" on the page)
    this.modalSubmitButton = page.getByRole('button', { name: 'Sign In', exact: true }).last();
  }

  async goto() {
    await this.page.goto('/');
  }

  async openLoginModal() {
    await this.signInButton.click();
    await this.loginModal.waitFor({ state: 'visible' });
  }

  async login(email: string, password: string) {
    await this.openLoginModal();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.modalSubmitButton.click();
  }
}
