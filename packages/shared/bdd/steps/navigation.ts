/**
 * Navigation Step Definitions
 * 
 * @module shared/bdd/steps/navigation
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { testWorld } from '../support/world';

/**
 * Navigate to a page by name
 * 
 * @example
 * Given I am on the "home" page
 */
Given('I am on the {string} page', async function(this: any, pageName: string) {
  const urls: Record<string, string> = {
    home: '/',
    login: '/login',
    register: '/register',
    profile: '/profile',
    'member-profile': '/member-profile',
    pricing: '/pricing',
  };
  
  const url = urls[pageName] || `/${pageName}`;
  await testWorld.page.goto(url);
});

/**
 * Navigate to a specific URL
 * 
 * @example
 * Given I navigate to "/dashboard"
 */
Given('I navigate to {string}', async function(this: any, url: string) {
  await testWorld.page.goto(url);
});

/**
 * Click a button by text
 * 
 * @example
 * When I click the "Submit" button
 */
When('I click the {string} button', async function(this: any, buttonText: string) {
  await testWorld.page.click(`button:has-text("${buttonText}")`);
});

/**
 * Click a link by text
 * 
 * @example
 * When I click the "Learn more" link
 */
When('I click the {string} link', async function(this: any, linkText: string) {
  await testWorld.page.click(`a:has-text("${linkText}")`);
});

/**
 * Wait for page to load
 * 
 * @example
 * Then I wait for the page to load
 */
Then('I wait for the page to load', async function(this: any) {
  await testWorld.page.waitForLoadState('networkidle');
});
