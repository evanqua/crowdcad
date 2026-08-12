@public
Feature: Reset password page
  Tests for the /reset-password page — reached via a "forgot password" email link.
  Runs without auth state (logged-out browser).

  Scenario: Visiting without a code shows an invalid link message
    Given I navigate to "/reset-password"
    Then I should see the heading "Invalid Reset Link"
    And I should see the text "This password reset link is invalid or has expired."

  Scenario: Visiting with a code shows the reset form
    Given I navigate to "/reset-password?token=some-test-token"
    Then I should see the heading "Reset Password"
    And I should see the "Enter new password" placeholder
    And I should see the "Confirm new password" placeholder

  Scenario: Submitting without a new password shows a validation error
    Given I navigate to "/reset-password?token=some-test-token"
    When I click the "Reset Password" button
    Then I should see the text "Enter a new password"

  Scenario: Submitting mismatched passwords shows a validation error
    Given I navigate to "/reset-password?token=some-test-token"
    When I fill the "Enter new password" placeholder with "NewPass123!"
    And I fill the "Confirm new password" placeholder with "DifferentPass456!"
    And I click the "Reset Password" button
    Then I should see the text "Passwords do not match"
