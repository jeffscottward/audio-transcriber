import { test, expect } from '@playwright/test';

test.describe('Audio Transcriber', () => {
  let consoleMessages: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture unhandled exceptions
    page.on('pageerror', (exception) => {
      consoleErrors.push(`Page error: ${exception.message}`);
    });

    // Navigate to the app
    await page.goto('http://localhost:3001');
  });

  test('should load the application without console errors', async ({ page }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check that the main heading is visible
    await expect(page.locator('h1')).toContainText('Audio Transcriber');
    
    // Check that the drop zone is visible
    await expect(page.locator('text=Drag & drop an audio or video file here')).toBeVisible();
    
    // Log any console errors for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors found:');
      consoleErrors.forEach(error => console.log(`  - ${error}`));
    }
    
    // Expect no critical console errors (allow warnings)
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('DevTools') && 
      !error.includes('Warning') &&
      !error.includes('[CEB]') // Ignore browser extension messages
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should show API key input', async ({ page }) => {
    const apiKeyInput = page.locator('input[type="password"]');
    await expect(apiKeyInput).toBeVisible();

    const placeholder = await apiKeyInput.getAttribute('placeholder');
    expect(placeholder).toContain('sk-');
  });

  // The drop zone's file input is hidden, so tests set files on it directly.
  test('should reject invalid file types', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not an audio file'),
    });

    await expect(page.locator('text=Invalid file type')).toBeVisible({ timeout: 5000 });
  });

  test('should accept large files without 25MB error', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'large-audio.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.alloc(30 * 1024 * 1024), // 30MB
    });

    await page.waitForTimeout(2000);
    await expect(page.locator('text=File is too large')).not.toBeVisible();
  });

  // Without an API key the app runs its simulated local transcription
  // (src/lib/localTranscription.ts); the in-browser Whisper model was removed.
  test('should transcribe with the local fallback when no API key is provided', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-audio.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.alloc(1024),
    });

    await expect(page.locator('text=simulated transcription')).toBeVisible({ timeout: 15000 });
  });

  test('should offer copy after transcription', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-audio.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.alloc(1024),
    });

    await expect(page.locator('text=simulated transcription')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /copy/i })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Log console messages for debugging
    if (consoleMessages.length > 0) {
      console.log('\\nConsole messages from test:');
      consoleMessages.forEach(msg => console.log(`  ${msg}`));
    }
    
    // Check for any unexpected errors
    const unexpectedErrors = consoleErrors.filter(error => 
      !error.includes('DevTools') && 
      !error.includes('[CEB]') &&
      !error.includes('Warning')
    );
    
    if (unexpectedErrors.length > 0) {
      console.log('\\nUnexpected console errors:');
      unexpectedErrors.forEach(error => console.log(`  - ${error}`));
    }
  });
});