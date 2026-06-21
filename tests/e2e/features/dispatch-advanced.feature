@authenticated
Feature: Dispatch board — advanced (venue with locations and equipment)
  Tests for dispatch features that require a venue pre-configured with locations and equipment.

  Background:
    Given I have a venue with location "Medical Tent" and equipment "Wheelchair 1" and am on the dispatch page

  Scenario: Equipment section shows configured venue equipment
    When I switch to the "Equipment" section
    Then I should see the text "Wheelchair 1"

  Scenario: Equipment status can be changed on the dispatch board
    When I switch to the "Equipment" section
    And I change equipment "Wheelchair 1" status to "In Use"
    Then the equipment "Wheelchair 1" should show status "In Use"

  Scenario: Posting Schedule modal opens
    When I click the "Posting Schedule" button
    Then I should see the heading "Schedule"
