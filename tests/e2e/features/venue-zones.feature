@authenticated
Feature: Venue map zones (dispatch areas)

  Background:
    Given I navigate to "/venues/management"
    And I fill the venue name with "Zone Test Venue"
    And I go to the "Map" venue step
    And I upload the venue map image "stage.png"

  Scenario: Add Area button appears after map upload
    Then I should see an "Add Area" button

  Scenario: Drawing and naming a plain area
    When I enable Add Area mode
    And I draw a triangular area on the venue map
    And I name the area "Storage"
    And I go to the "Locations" venue step
    Then I should see the area "Storage" in the areas list

  Scenario: Marking an area as a dispatch zone
    When I enable Add Area mode
    And I draw a triangular area on the venue map
    And I name the area "Zone 2" and mark it a dispatch zone
    And I go to the "Locations" venue step
    Then I should see the area "Zone 2" in the areas list
    And the area "Zone 2" should be marked as a dispatch zone
