
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
    test('should not have any automatically detectable accessibility issues', async ({ page }) => {
        await page.goto('/');

        // Analyze accessibility
        const accessibilityScanResults = await new AxeBuilder({ page })
            // Exclude the canvas itself from color contrast if necessary, 
            // but generally we want to check the UI overlay.
            .exclude('canvas')
            .analyze();

        // Log violations for debugging if test fails
        if (accessibilityScanResults.violations.length > 0) {
            console.log('Accessibility Violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
        }

        expect(accessibilityScanResults.violations).toEqual([]);
    });
});
