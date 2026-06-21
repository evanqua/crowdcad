@authenticated
Feature: Profile page
  Tests for the /profile page — authenticated user.

  Background:
    Given I navigate to "/profile"
    And the profile page is loaded

  Scenario: All four vertical tabs are shown
    Then I should see the "Account" tab
    And I should see the "Affiliations & Access" tab
    And I should see the "Data & Privacy" tab
    And I should see the "Preferences" tab

  Scenario: Account tab is selected by default and shows user email
    Then the "Account" tab should be selected
    And I should see the logged in user email

  Scenario: Account tab shows Security section with password fields
    Then I should see the heading "Security"
    And I should see the "Enter current password" placeholder
    And I should see the "Enter new password" placeholder
    And I should see the "Confirm new password" placeholder
    And I should see an "Update Password" button

  Scenario: Account tab shows Sign Out button in Session section
    Then I should see the heading "Session"
    And I should see a "Sign Out" button

  Scenario: Affiliations & Access tab shows unavailability message
    When I click the "Affiliations & Access" tab
    Then I should see the heading "Affiliations & Access"
    And I should see the text "Organization features are currently unavailable."

  Scenario: Data & Privacy tab shows data section and action buttons
    When I click the "Data & Privacy" tab
    Then I should see the heading "Data & Privacy"
    And I should see the text "Dispatch Logs"
    And I should see an "Export Data" button
    And I should see a "Delete Account" button

  Scenario: Preferences tab shows coming soon message
    When I click the "Preferences" tab
    Then I should see the heading "Preferences"
    And I should see the text "Preferences configuration coming soon..."

  Scenario: Profile is accessible via the navbar profile dropdown
    Given I navigate to "/"
    When I click the "Open profile menu" button
    And I click the "Profile" menu item
    Then the URL should be "/profile"
    And the profile page is loaded

  Scenario: Sign Out transitions the page to the not-signed-in state
    When I click the "Sign Out" button
    Then I should see the text "You are not signed in."

  Scenario: Password change shows error when passwords do not match
    When I fill the "Enter current password" placeholder with "SomePassword123!"
    And I fill the "Enter new password" placeholder with "NewPass123!"
    And I fill the "Confirm new password" placeholder with "DifferentPass456!"
    And I click the "Update Password" button
    Then I should see the text "New passwords do not match"

  Scenario: Password change shows error when current password is empty
    When I fill the "Enter new password" placeholder with "NewPass123!"
    And I fill the "Confirm new password" placeholder with "NewPass123!"
    And I click the "Update Password" button
    Then I should see the text "Enter your current password"

  Scenario: Delete Account button opens confirmation dialog
    When I click the "Data & Privacy" tab
    And I click the "Delete Account" button
    Then I should see the text "This action cannot be undone"

  Scenario: Delete Account cancel closes the dialog
    When I click the "Data & Privacy" tab
    And I click the "Delete Account" button
    And I click the "Cancel" button
    Then I should not see the text "This action cannot be undone"
