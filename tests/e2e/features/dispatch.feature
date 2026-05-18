@authenticated
Feature: Dispatch board
  Tests for the event dispatch page at /events/[id]/dispatch

  Background:
    Given I have created an event and am on the dispatch page

  Scenario: Dispatch board renders
    Then I should see the teams section

  Scenario: Calls section visible
    Then I should see the text "Total Calls:"

  Scenario: Quick call modal opens
    When I open the quick call modal
    Then I should see the modal text "Add Call"

  Scenario: A call can be logged
    When I open the quick call modal
    And I log a call with location "Main Stage" and complaint "Chest Pain"
    Then the call should appear in the call list

  Scenario: A team can be added to the dispatch board
    When I open the add team modal
    And I create a team named "Alpha" with a member "John Doe" certified as "FA"
    Then the team "Alpha" should appear in the teams list

  Scenario: A call without a team assigned shows Pending status
    When I open the quick call modal
    And I log a call with location "Parking Lot" and complaint "Laceration"
    Then the call should appear in the call list
    And I should see the text "Pending"

  Scenario: Assigning a call to a team changes team status to En Route
    When I open the add team modal
    And I create a team named "Bravo" with a member "Jane Smith" certified as "FR"
    And I open the quick call modal
    And I log a call assigned to team "Bravo" at location "Main Stage" with complaint "Chest Pain"
    Then the call should appear in the call list
    And the team "Bravo" should have status "En Route"

  Scenario: Cancelling the quick call modal clears the form
    When I open the quick call modal
    And I fill the quick call location with "West Gate"
    And I cancel the quick call modal
    And I open the quick call modal
    Then the quick call location field should be empty

  Scenario: End event modal opens and shows summary options
    When I open the end event modal
    Then I should see the text "End with no summary"
    And I should see the text "Quick summary"
    When I close the end event modal
    Then the end event modal should be closed

  Scenario: Switching to supervisors section shows empty state
    When I switch to the "Supervisors" section
    Then I should see the text "No supervisors assigned"

  Scenario: A supervisor can be added to the dispatch board
    When I switch to the "Supervisors" section
    And I open the add supervisor modal
    And I create a supervisor with call sign "Command-1" and certification "FR"
    Then the supervisor "Command-1" should appear in the supervisors list

  Scenario: Multiple calls can be logged sequentially
    When I open the quick call modal
    And I log a call with location "Main Stage" and complaint "Chest Pain"
    And I open the quick call modal
    And I log a call with location "VIP Area" and complaint "Allergic Reaction"
    Then I should see the text "Main Stage"
    And I should see the text "VIP Area"

  Scenario: Team status can be progressed from En Route to On Scene
    When I open the add team modal
    And I create a team named "Echo" with a member "Sam Lee" certified as "FA"
    And I open the quick call modal
    And I log a call assigned to team "Echo" at location "South Gate" with complaint "Fall"
    Then the team "Echo" should have status "En Route"
    When I change team "Echo" status on the call to "On Scene"
    Then the team "Echo" should have status "On Scene"

  Scenario: Refusal status closes the call and returns the team to Available
    When I open the add team modal
    And I create a team named "Delta" with a member "Chris Roy" certified as "FR"
    And I open the quick call modal
    And I log a call assigned to team "Delta" at location "North Entrance" with complaint "Headache"
    Then the team "Delta" should have status "En Route"
    When I change team "Delta" status on the call to "Refusal"
    Then the team "Delta" should have status "Available"

  Scenario: Full call lifecycle — En Route, Transporting, then Delivered puts team In Clinic
    When I open the add team modal
    And I create a team named "Foxtrot" with a member "Dana Kim" certified as "FR"
    And I open the quick call modal
    And I log a call assigned to team "Foxtrot" at location "Medical Tent" with complaint "Seizure"
    Then the team "Foxtrot" should have status "En Route"
    When I change team "Foxtrot" status on the call to "Transporting"
    Then the team "Foxtrot" should have status "Transporting"
    When I change team "Foxtrot" status on the call to "Delivered"
    Then the team "Foxtrot" should have status "In Clinic"

  Scenario: NMM status closes the call and returns the team to Available
    When I open the add team modal
    And I create a team named "Golf" with a member "Pat Chen" certified as "FA"
    And I open the quick call modal
    And I log a call assigned to team "Golf" at location "East Gate" with complaint "Nausea"
    Then the team "Golf" should have status "En Route"
    When I change team "Golf" status on the call to "NMM"
    Then the team "Golf" should have status "Available"

  Scenario: Total Calls counter reflects the number of logged calls
    When I open the quick call modal
    And I log a call with location "Stage Left" and complaint "Sprain"
    And I open the quick call modal
    And I log a call with location "Stage Right" and complaint "Headache"
    Then I should see the text "Total Calls: 2"

  Scenario: End event Continue button is disabled until a choice is selected
    When I open the end event modal
    Then the end event continue button should be disabled
    When I select the "End with no summary" option
    Then the end event continue button should be enabled
    When I close the end event modal
    Then the end event modal should be closed

  Scenario: A team can be deleted from the dispatch board
    When I open the add team modal
    And I create a team named "Hotel" with a member "Sam Park" certified as "FR"
    Then the team "Hotel" should appear in the teams list
    When I delete the team "Hotel"
    Then the team "Hotel" should not be visible

  Scenario: Venue Map modal opens
    When I click the "Venue Map" button
    Then I should see the text "No map"

  Scenario: Posting Schedule modal opens
    When I click the "Posting Schedule" button
    Then I should see the heading "Schedule"

  Scenario: Equipment section shows empty state when no equipment is configured
    When I switch to the "Equipment" section
    Then I should see the text "No equipment configured"

  Scenario: A supervisor can be deleted from the dispatch board
    When I switch to the "Supervisors" section
    And I open the add supervisor modal
    And I create a supervisor with call sign "Command-Del" and certification "FR"
    Then the supervisor "Command-Del" should appear in the supervisors list
    When I delete the supervisor "Command-Del"
    Then I should see the text "No supervisors assigned"

  Scenario: End event with quick summary navigates to summary page
    When I open the end event modal
    And I select the "Quick summary" option
    And I click the end event continue button
    Then the URL should contain "/summary"

  Scenario: End event with no summary navigates to venue selection
    When I open the end event modal
    And I select the "End with no summary" option
    And I click the end event continue button
    Then the URL should contain "/venues/selection"

  Scenario: Multiple teams can coexist on the dispatch board
    When I open the add team modal
    And I create a team named "Multi-A" with a member "User A" certified as "FR"
    And I open the add team modal
    And I create a team named "Multi-B" with a member "User B" certified as "FA"
    Then the team "Multi-A" should appear in the teams list
    And the team "Multi-B" should appear in the teams list
