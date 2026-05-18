@authenticated
Feature: Event creation
  Tests for the event creation form at /events/[id]/create

  Background:
    Given I have a venue ready for event creation
    And I have started a new draft event from that venue

  Scenario: Form renders correctly
    Then I should see the "Enter event name" placeholder
    And I should see the "Teams" tab
    And I should see the "Supervisors" tab
    And I should see the "Posts" tab
    And I should see the "Equipment" tab

  Scenario: Add a team via modal
    When I click the add team button
    And I fill the "Team name" field with "Alpha"
    And I fill the "Member name" field with "John"
    And I select "FR" from the "Certification" dropdown
    And I click the "Add member" button in the modal
    And I click the "Add Team" button in the modal
    Then I should see the text "Alpha"

  Scenario: Creating event navigates to dispatch
    When I fill the event name with "Test Event"
    And I click the "Create Event" button
    Then the URL should contain "/dispatch"

  Scenario: Supervisors tab renders correctly
    When I click the "Supervisors" tab
    Then I should see the heading "Supervisors"

  Scenario: Equipment tab renders correctly
    When I click the "Equipment" tab
    Then I should see the heading "Equipment"

  Scenario: A supervisor can be added during event creation
    When I click the "Supervisors" tab
    And I click the add event supervisor button
    And I fill the supervisor call sign with "Lead-1"
    And I select event supervisor certification "FR"
    And I click the "Add Supervisor" button in the modal
    Then I should see the text "Lead-1"

  Scenario: Event name field accepts input
    When I fill the event name with "My Custom Event"
    Then I should see the "Enter event name" placeholder
