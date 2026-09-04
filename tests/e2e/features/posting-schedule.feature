@authenticated
Feature: Posting Schedule
  Tests for the dispatch board's Posting Schedule modal, which only appears
  once an event has posts enabled — kept in its own feature file (rather
  than added to dispatch.feature/dispatch-advanced.feature's shared
  background) so the extra Post schedule step navigation this requires
  doesn't add overhead to every other scenario in those files.

  Background:
    Given I have created an event with posts enabled and am on the dispatch page

  Scenario: Posting Schedule modal opens
    When I click the "Posting Schedule" button
    Then I should see the heading "Schedule"
