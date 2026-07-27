/**
 * Assertion Step Definitions
 * 
 * @module shared/bdd/steps/assertion
 */

import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { testWorld } from '../support/world';

/**
 * Assert page contains text
 * 
 * @example
 * Then I should see "Welcome"
 */
Then('I should see {string}', async function(this: any, text: string) {
  await expect(testWorld.page.locator(`text=${text}`)).toBeVisible();
});

/**
 * Assert page does not contain text
 * 
 * @example
 * Then I should not see "Error"
 */
Then('I should not see {string}', async function(this: any, text: string) {
  await expect(testWorld.page.locator(`text=${text}`)).not.toBeVisible();
});

/**
 * Assert element is visible
 * 
 * @example
 * Then the ".error-message" should be visible
 */
Then('the {string} should be visible', async function(this: any, selector: string) {
  await expect(testWorld.page.locator(selector)).toBeVisible();
});

/**
 * Assert element is not visible
 * 
 * @example
 * Then the ".loading" should not be visible
 */
Then('the {string} should not be visible', async function(this: any, selector: string) {
  await expect(testWorld.page.locator(selector)).not.toBeVisible();
});

/**
 * Assert element contains text
 * 
 * @example
 * Then the ".title" should contain "Dashboard"
 */
Then('the {string} should contain {string}', async function(
  this: any,
  selector: string,
  text: string
) {
  await expect(testWorld.page.locator(selector)).toContainText(text);
});

/**
 * Assert current URL matches
 * 
 * @example
 * Then the URL should be "/dashboard"
 */
Then('the URL should be {string}', async function(this: any, url: string) {
  await expect(testWorld.page).toHaveURL(new RegExp(url));
});
