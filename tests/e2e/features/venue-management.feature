@authenticated
Feature: Venue management
  Tests for the venue creation form at /venues/management
  and the search filter on the venue selection page.

  Background:
    Given I navigate to "/venues/management"

  Scenario: All main form sections are rendered
    Then I should see the venue name input
    And I should see the "Locations" tab
    And I should see the "Equipment" tab
    And I should see the location name input
    And I should see a "Cancel" button
    And I should see a "Create Venue" button
    And I should see the layer name input

  Scenario: Create Venue button is disabled until a venue name is entered
    Then the "Create Venue" button should be disabled
    When I fill the venue name with "Test Arena"
    Then the "Create Venue" button should be enabled
    When I clear the venue name
    Then the "Create Venue" button should be disabled

  Scenario: Equipment tab shows its input; switching tabs works
    When I click the "Equipment" tab
    Then I should see the equipment name input
    When I click the "Locations" tab
    Then I should see the location name input

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
    When I add a location named "Medical Tent"
    Then I should see the text "Medical Tent"

  Scenario: Adding equipment appears in the list
    When I click the "Equipment" tab
    And I add equipment named "Gurney 1"
    Then I should see the text "Gurney 1"

  Scenario: A location can be deleted
    When I add a location named "Temp Location"
    Then I should see the text "Temp Location"
    When I delete the location "Temp Location"
    Then I should not see the text "Temp Location"

  Scenario: An equipment item can be deleted
    When I click the "Equipment" tab
    And I add equipment named "Temp Gurney"
    Then I should see the text "Temp Gurney"
    When I delete the equipment "Temp Gurney"
    Then I should not see the text "Temp Gurney"

  Scenario: Multiple locations can be added
    When I add a location named "Location A"
    And I add a location named "Location B"
    Then I should see the text "Location A"
    And I should see the text "Location B"
