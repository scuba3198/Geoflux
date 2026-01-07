
import { test, expect } from '@playwright/test';

test.describe('Geoflux E2E', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should load the application with correct title and elements', async ({ page }) => {
        // Check for the main header
        await expect(page.getByText('GEOFLUX')).toBeVisible();
        await expect(page.getByText('Generative Sandbox')).toBeVisible();

        // Check for the canvas
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();

        // Check for credit
        await expect(page.getByText('by Mumukshu D.C')).toBeVisible();
    });

    test('should toggle the controls panel', async ({ page }) => {
        const settingsPanel = page.getByText('Parameters');
        const openButton = page.getByRole('button', { name: 'Open controls' });
        const closeButton = page.getByRole('button', { name: 'Close controls' });

        // Initial state: Controls are hidden
        await expect(openButton).toBeVisible();
        await openButton.click();

        await expect(settingsPanel).toBeVisible();
        await expect(closeButton).toBeVisible();
        await closeButton.click();

        // Wait for state update and animation
        // The panel translates out, and the Toggle button appears.

        // Selector for Open (Settings) button
        // It is a button containing an SVG with class 'lucide-settings'
        await expect(openButton).toBeVisible({ timeout: 10000 });

        // Click Open button
        await openButton.click();

        // Wait for panel to return
        await expect(settingsPanel).toBeVisible();

        // Open button should be gone
        await expect(openButton).not.toBeVisible();
    });

    test('should allow adjusting parameters', async ({ page }) => {
        const openButton = page.getByRole('button', { name: 'Open controls' });
        await expect(openButton).toBeVisible();
        await openButton.click();

        await expect(page.getByText('Parameters')).toBeVisible();

        // Check if Density slider exists
        const densityInput = page.locator('input[type="range"]').first(); // Or specific one
        await expect(densityInput).toBeVisible();

        // Check initial value (density starts at 50)
        await expect(densityInput).toHaveValue('50');

        // Change value
        await densityInput.fill('100');
        await expect(densityInput).toHaveValue('100');

        // Verify text update if applicable (The UI shows "{params.density}%")
        await expect(page.getByText('100%')).toBeVisible();
    });
});
