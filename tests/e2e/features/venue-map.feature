@authenticated
Feature: Venue map management

  Background:
    Given I navigate to "/venues/management"

  Scenario: Upload a map image to the default layer
    When I upload the venue map image "stage.png"
    Then the venue map should be displayed

  Scenario: Add Markers button appears after map upload
    When I upload the venue map image "stage.png"
    Then I should see an "Add Markers" button

  Scenario: Placing a named marker on the map
    When I upload the venue map image "stage.png"
    And I enable Add Markers mode
    And I click on the center of the venue map
    And I name the marker "Gate A"
    Then I should see the text "Gate A"

  Scenario: Adding a new layer via the modal
    When I upload the venue map image "stage.png"
    And I open the add layer modal
    And I fill the layer name with "Floor 2"
    And I upload the layer map image "stage.png"
    And I confirm adding the layer
    Then I should see the layer named "Floor 2"

  Scenario: Editing the default layer name
    When I clear the layer name and type "Main Floor"
    Then the layer name input should show "Main Floor"
