@authenticated
Feature: Venue and event deletion
  Tests for deleting venues from the venue selection page.

  Background:
    Given I have a venue on the selection page

  Scenario: Delete option appears in venue actions menu
    When I open the venue actions menu
    Then I should see the text "Delete"

  Scenario: Deleting a venue removes it from the list
    When I open the venue actions menu
    And I confirm venue deletion
    Then the venue should no longer be visible

  Scenario: Venue deletion can be cancelled via the dialog
    When I open the venue actions menu
    And I cancel venue deletion
    Then the venue should still be visible
