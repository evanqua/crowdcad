@authenticated
Feature: Main navigation
  Navigation smoke tests for authenticated users.

  Background:
    Given I am on the venue selection page

  Scenario: Navbar contains Home and Venues links
    Then I should see a "Home" link
    And I should see a "Venues" link

  Scenario: Home link navigates to the landing page
    When I click the "Home" link
    Then the URL should be "/"
    And I should see the heading "Welcome back to CrowdCAD"

  Scenario: Venues link navigates to venue selection
    Given I navigate to "/"
    When I click the "Venues" link
    Then the URL should be "/venues/selection"

  Scenario: Profile page loads for authenticated user
    Given I navigate to "/profile"
    Then I should see the "Account" tab

  Scenario: Authenticated landing page shows Start a New Event
    Given I navigate to "/"
    Then I should see a "Start a New Event" button
    And I should not see a "Sign In" button
    When I click the "Start a New Event" button
    Then the URL should be "/venues/selection"
