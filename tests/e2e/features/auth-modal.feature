@public
Feature: Login modal
  Tests for the login / signup modal on the landing page.
  Runs without auth state (logged-out browser).

  Background:
    Given I am on the landing page

  Scenario: Modal opens with correct structure
    When I click the "Sign In" button
    Then the login modal should have the title "Login"
    And the "Email Address" field should be visible in the modal
    And the "Password" field should be visible in the modal
    And I should see a "Cancel" button in the modal
    And I should see a "Login" submit button in the modal
    And I should see the modal text "Don't have an account?"

  Scenario: Login button is disabled until both fields are filled
    When I click the "Sign In" button
    Then the "Login" submit button should be disabled
    When I fill the "Email Address" field with "test@example.com"
    Then the "Login" submit button should be disabled
    When I clear the "Email Address" field
    And I fill the "Password" field with "password123"
    Then the "Login" submit button should be disabled
    When I fill the "Email Address" field with "test@example.com"
    Then the "Login" submit button should be enabled

  Scenario: Error is shown on invalid credentials
    When I click the "Sign In" button
    And I fill the "Email Address" field with "wrong@example.com"
    And I fill the "Password" field with "WrongPassword999!"
    And I click the "Login" submit button
    Then the login modal should be visible
    And the URL should be "/"

  Scenario: Cancel button closes the modal
    When I click the "Sign In" button
    Then the login modal should be visible
    When I click the "Cancel" button in the modal
    Then the login modal should not be visible
    And the URL should be "/"

  Scenario: Switching to signup mode shows Confirm Password field
    When I click the "Sign In" button
    Then the "Confirm Password" field should not be visible in the modal
    When I click the "Sign Up" button in the modal
    Then the login modal should have the title "Create an Account"
    And the "Confirm Password" field should be visible in the modal
    And the "Sign Up" submit button should be disabled
    And I should see the modal text "Already have an account?"

  Scenario: Switching back to login mode hides Confirm Password
    When I click the "Sign In" button
    And I click the "Sign Up" button in the modal
    And I click the "Log in" button in the modal
    Then the login modal should have the title "Login"
    And the "Confirm Password" field should not be visible in the modal

  Scenario: Signup shows error when passwords do not match
    When I click the "Sign In" button
    And I click the "Sign Up" button in the modal
    And I fill the "Email Address" field with "newuser@example.com"
    And I fill the "Password" field with "Password123!"
    And I fill the "Confirm Password" field with "DifferentPassword456!"
    And I click the "Sign Up" submit button
    Then I should see the modal error "Passwords do not match"
    And the login modal should be visible

  Scenario: Modal auto-opens with ?login=true query param
    Given I navigate to "/?login=true"
    Then the login modal should be visible

  Scenario: Auth error message shown with ?login=true&error=auth
    Given I navigate to "/?login=true&error=auth"
    Then the login modal should be visible
    And I should see the modal error "Please sign in to access this page"

  Scenario: Successful login closes the modal
    When I click the "Sign In" button
    And I fill the "Email Address" field with the test user email
    And I fill the "Password" field with the test user password
    And I click the "Login" submit button
    Then the login modal should not be visible

  Scenario: Successful signup closes the modal
    When I click the "Sign In" button
    And I click the "Sign Up" button in the modal
    And I fill the "Email Address" field with a unique signup email
    And I fill the "Password" field with "SecurePass123!"
    And I fill the "Confirm Password" field with "SecurePass123!"
    And I click the "Sign Up" submit button
    Then the login modal should not be visible
