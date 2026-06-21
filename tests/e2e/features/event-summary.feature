@authenticated
Feature: Event summary page
  Tests for the event summary at /events/[id]/summary

  Background:
    Given I have ended an event and am on the summary page

  Scenario: Summary page renders heading and stat cards
    Then I should see the text "Event Summary:"
    And I should see the text "Total Calls"
    And I should see the text "Delivered to Clinic"
    And I should see the text "Transported"
    And I should see a "Export Logs" button

  Scenario: Staff Logs and Call Logs sections are displayed and can be toggled
    Then I should see the text "Staff Logs"
    And I should see the text "Call Logs"
    When I click the staff logs show button
    Then I should see staff log entries
    When I click the call logs show button
    Then I should see call log entries

  Scenario: Export Logs triggers a CSV download
    Then clicking "Export Logs" should trigger a CSV download
