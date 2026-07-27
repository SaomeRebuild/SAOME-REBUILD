/**
 * Cucumber Hooks
 * 
 * @module shared/bdd/steps/hooks
 */

import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { testWorld, initializeBrowser, closeBrowser } from '../support/world';

/**
 * Setup before all scenarios
 */
BeforeAll(async function() {
  await initializeBrowser();
});

/**
 * Cleanup after all scenarios
 */
AfterAll(async function() {
  await closeBrowser();
});

/**
 * Reset browser state before each scenario
 */
Before(async function() {
  // Clear cookies and localStorage
  await testWorld.context?.clearCookies();
  await testWorld.page?.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

/**
 * Take screenshot on failure
 */
After(async function(this: any) {
  if (this.pickle?.status === 'FAILED') {
    const scenarioName = this.pickle?.name || 'unknown';
    const timestamp = Date.now();
    const screenshotPath = `reports/screenshots/${scenarioName}-${timestamp}.png`;
    
    await testWorld.page?.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    
    console.log(`Screenshot saved: ${screenshotPath}`);
  }
});
