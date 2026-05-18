@public
Feature: Landing page
  Public smoke tests for the CrowdCAD landing page.

  Background:
    Given I am on the landing page

  Scenario: Correct document title
    Then the page title should be "CrowdCAD"

  Scenario: Main heading is displayed
    Then I should see the heading "Welcome back to CrowdCAD"

  Scenario: Sign In button is shown when logged out
    Then I should see a "Sign In" button

  Scenario: Login modal opens when Sign In is clicked
    When I click the "Sign In" button
    Then the login modal should be visible

  Scenario: Footer link is shown
    Then I should see a link "crowdcad.org"
