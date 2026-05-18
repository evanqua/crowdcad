@authenticated
Feature: Clinic operations on the dispatch board
  Tests for the clinic walkup modal, clinic tracking table, and patient outcomes.

  Background:
    Given I have created an event and am on the dispatch page

  Scenario: Clinic section shows zero unresolved count initially
    When I switch to the "Clinic" section
    Then I should see the text "Clinic (0)"

  Scenario: Clinic walkup modal opens
    When I switch to the "Clinic" section
    And I click the "Add Clinic Call" button
    Then I should see the text "Add Clinic Walkup"

  Scenario: Clinic walkup modal can be cancelled
    When I switch to the "Clinic" section
    And I click the "Add Clinic Call" button
    And I click the "Cancel" button
    Then I should not see the text "Add Clinic Walkup"

  Scenario: Delivered call appears in clinic tracking
    When I open the add team modal
    And I create a team named "ClinicTeam" with a member "Alex Test" certified as "FR"
    And I open the quick call modal
    And I log a call assigned to team "ClinicTeam" at location "Stage" with complaint "Syncope"
    And I change team "ClinicTeam" status on the call to "Transporting"
    And I change team "ClinicTeam" status on the call to "Delivered"
    And I switch to the "Clinic" section
    Then I should see the text "Clinic (1)"

  Scenario: Clinic outcome can be set to Discharged
    When I open the add team modal
    And I create a team named "ClinicTeam2" with a member "Beth Test" certified as "FR"
    And I open the quick call modal
    And I log a call assigned to team "ClinicTeam2" at location "VIP" with complaint "Laceration"
    And I change team "ClinicTeam2" status on the call to "Transporting"
    And I change team "ClinicTeam2" status on the call to "Delivered"
    And I switch to the "Clinic" section
    And I set the clinic outcome for the latest call to "Discharged"
    Then I should see the text "Discharged"

  Scenario: Clinic outcome can be set to AMA
    When I open the add team modal
    And I create a team named "ClinicTeam3" with a member "Carl Test" certified as "FA"
    And I open the quick call modal
    And I log a call assigned to team "ClinicTeam3" at location "Gate A" with complaint "Nausea"
    And I change team "ClinicTeam3" status on the call to "Transporting"
    And I change team "ClinicTeam3" status on the call to "Delivered"
    And I switch to the "Clinic" section
    And I set the clinic outcome for the latest call to "AMA"
    Then I should see the text "AMA"
