@authenticated
Feature: Venue selection page
  Smoke tests for the venue selection page.
  Runs with saved auth state — user is already logged in.

  Background:
    Given I am on the venue selection page

  Scenario: Page loads without redirecting to login
    Then the URL should be "/venues/selection"

  Scenario: Page heading is shown
    Then I should see the "Venue Selection" or "Your Venues" heading

  Scenario: New Venue button is rendered
    Then I should see a "New Venue" button

  Scenario: Venue search input is rendered
    Then I should see the venue search input

  Scenario: Clicking New Venue navigates to venue management
    When I click the "New Venue" button
    Then the URL should be "/venues/management"
