@authenticated
Feature: Venue management
  Tests for the venue creation stepper at /venues/management
  and the search filter on the venue selection page.

  Background:
    Given I navigate to "/venues/management"

  Scenario: Every step is reachable once a venue name is entered
    Then I should see the venue name input
    When I fill the venue name with "Test Arena"
    And I go to the "Map & floors" venue step
    Then I should see the layer name input
    When I go to the "Locations" venue step
    Then I should see the location name input
    When I go to the "Equipment" venue step
    Then I should see the equipment name input
    When I go to the "Review & save" venue step
    Then I should see a "Create Venue" button

  Scenario: Continue is disabled until a venue name is entered
    Then the "Continue" button should be disabled
    When I fill the venue name with "Test Arena"
    Then the "Continue" button should be enabled
    When I clear the venue name
    Then the "Continue" button should be disabled

  Scenario: Create Venue becomes available once a venue name is entered
    When I fill the venue name with "Test Arena"
    And I go to the "Review & save" venue step
    Then the "Create Venue" button should be enabled

  Scenario: Clearing the venue name locks the later steps again
    When I fill the venue name with "Test Arena"
    And I go to the "Review & save" venue step
    And I go to the "Basics" venue step
    And I clear the venue name
    Then the "Continue" button should be disabled

  Scenario: Cancel button navigates back to venue selection
    When I fill the venue name with "Unfinished Venue"
    And I click the "Cancel" button
    Then the URL should be "/venues/selection"
    And I should see the "Venue Selection" or "Your Venues" heading

  Scenario: Submitting a venue name saves it and redirects to selection
    When I create a venue with a unique name
    Then the URL should be "/venues/selection"
    And the newly created venue should be visible

  Scenario: Search filter filters and clears venue list
    When I create two venues with unique names
    Then both created venues should be visible
    When I search for the first venue
    Then only the first venue should be visible
    When I clear the search
    Then both created venues should be visible
    When I search for "zzz-no-match-xyz"
    Then neither created venue should be visible

  Scenario: Adding a location appears in the list
    When I fill the venue name with "Test Arena"
    And I go to the "Locations" venue step
    And I add a location named "Medical Tent"
    Then I should see the text "Medical Tent"

  Scenario: Adding equipment appears in the list
    When I fill the venue name with "Test Arena"
    And I go to the "Equipment" venue step
    And I add equipment named "Gurney 1"
    Then I should see the text "Gurney 1"

  Scenario: A location can be deleted
    When I fill the venue name with "Test Arena"
    And I go to the "Locations" venue step
    And I add a location named "Temp Location"
    Then I should see the text "Temp Location"
    When I delete the location "Temp Location"
    Then I should not see the text "Temp Location"

  Scenario: An equipment item can be deleted
    When I fill the venue name with "Test Arena"
    And I go to the "Equipment" venue step
    And I add equipment named "Temp Gurney"
    Then I should see the text "Temp Gurney"
    When I delete the equipment "Temp Gurney"
    Then I should not see the text "Temp Gurney"

  Scenario: Multiple locations can be added
    When I fill the venue name with "Test Arena"
    And I go to the "Locations" venue step
    And I add a location named "Location A"
    And I add a location named "Location B"
    Then I should see the text "Location A"
    And I should see the text "Location B"

  Scenario: Non-linear navigation preserves entered data
    When I fill the venue name with "Preserved Venue"
    And I go to the "Locations" venue step
    And I add a location named "Backstage"
    And I go to the "Basics" venue step
    Then the venue name input should show "Preserved Venue"
    When I go to the "Locations" venue step
    Then I should see the text "Backstage"
