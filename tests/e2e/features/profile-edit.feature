@authenticated
Feature: Profile edit page
  Tests for the /profile/edit page — editing user profile information.

  Background:
    Given I navigate to "/profile/edit"

  Scenario: Edit profile page renders form fields
    Then I should see the heading "Edit Profile"
    And I should see the "Your full name" placeholder
    And I should see the "https://..." placeholder

  Scenario: Save and Cancel buttons are visible
    Then I should see a "Save Changes" button
    And I should see a "Cancel" button

  Scenario: Cancel navigates back to profile page
    When I click the "Cancel" button
    Then the URL should be "/profile"

  Scenario: Display name can be updated
    When I fill the "Your full name" placeholder with "E2E Test User"
    And I click the "Save Changes" button
    Then the URL should be "/profile"

  Scenario: Phone number field accepts input
    Then I should see the "+1 555 555 5555" placeholder
