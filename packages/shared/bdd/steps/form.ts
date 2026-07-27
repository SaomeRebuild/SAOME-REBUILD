/**
 * Form Step Definitions
 * 
 * @module shared/bdd/steps/form
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { testWorld } from '../support/world';

/**
 * Fill in a text input
 * 
 * @example
 * Given I fill in "email" with "test@example.com"
 */
Given('I fill in {string} with {string}', async function(
  this: any,
  field: string,
  value: string
) {
  const locator = testWorld.page.locator(`[name="${field}"]`).first();
  await locator.fill(value);
});

/**
 * Fill in textarea
 * 
 * @example
 * Given I fill in the textarea "description" with "Hello"
 */
Given('I fill in the textarea {string} with {string}', async function(
  this: any,
  field: string,
  value: string
) {
  const locator = testWorld.page.locator(`textarea[name="${field}"]`).first();
  await locator.fill(value);
});

/**
 * Select an option from dropdown
 * 
 * @example
 * Given I select "Gold" from "tier"
 */
Given('I select {string} from {string}', async function(
  this: any,
  option: string,
  field: string
) {
  await testWorld.page.selectOption(`select[name="${field}"]`, option);
});

/**
 * Check a checkbox
 * 
 * @example
 * Given I check "agree-terms"
 */
Given('I check {string}', async function(this: any, checkboxId: string) {
  await testWorld.page.check(`#${checkboxId}`);
});

/**
 * Uncheck a checkbox
 * 
 * @example
 * Given I uncheck "subscribe"
 */
Given('I uncheck {string}', async function(this: any, checkboxId: string) {
  await testWorld.page.uncheck(`#${checkboxId}`);
});

/**
 * Submit a form
 * 
 * @example
 * When I submit the form
 */
When('I submit the form', async function(this: any) {
  await testWorld.page.click('button[type="submit"]');
});
