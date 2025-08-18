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
    expect(placeholder).toContain('OpenAI API key');
  });

  test('should reject invalid file types', async ({ page }) => {
    // Create a test file with invalid type
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('input[type="file"]').click();
    const fileChooser = await fileChooserPromise;
    
    // Try to upload a text file (should be rejected)
    const invalidFile = Buffer.from('This is not an audio file');
    await fileChooser.setFiles([{
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: invalidFile
    }]);
    
    // Should show error message
    await expect(page.locator('text=Invalid file type')).toBeVisible({ timeout: 5000 });
  });

  test('should accept large files without 25MB error', async ({ page }) => {
    // Create a large dummy audio file (simulate 30MB)
    const largeBuffer = Buffer.alloc(30 * 1024 * 1024); // 30MB
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('input[type="file"]').click();
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([{
      name: 'large-audio.mp3',
      mimeType: 'audio/mpeg',
      buffer: largeBuffer
    }]);
    
    // Should NOT show "File is too large" error
    await page.waitForTimeout(2000);
    const errorMessage = page.locator('text=File is too large');
    await expect(errorMessage).not.toBeVisible();
  });

  test('should show processing state when no API key is provided', async ({ page }) => {
    // Create a small audio file
    const audioBuffer = Buffer.alloc(1024); // 1KB dummy file
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('input[type="file"]').click();
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([{
      name: 'test-audio.mp3',
      mimeType: 'audio/mpeg',
      buffer: audioBuffer
    }]);
    
    // Should show local processing indication
    await expect(page.locator('text=Processing locally')).toBeVisible({ timeout: 10000 });
  });

  test('should show model loading progress for local transcription', async ({ page }) => {
    // Create a large audio file to trigger chunked processing
    const largeAudioBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('input[type="file"]').click();
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([{
      name: 'large-test-audio.mp3',
      mimeType: 'audio/mpeg',
      buffer: largeAudioBuffer
    }]);
    
    // Should show model loading progress
    await expect(page.locator('text=Loading AI model')).toBeVisible({ timeout: 15000 });
    
    // Should show progress percentage
    await expect(page.locator('text=%')).toBeVisible({ timeout: 20000 });
  });

  test('should provide download options after transcription', async ({ page }) => {
    // For this test, we'll use a small file and wait for transcription to complete
    // Note: This test requires the local Whisper model to be available
    
    const audioBuffer = Buffer.alloc(1024);
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('input[type="file"]').click();
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([{
      name: 'test-audio.mp3',
      mimeType: 'audio/mpeg',
      buffer: audioBuffer
    }]);
    
    // Wait for transcription to complete (this might take a while)
    await expect(page.locator('text=Download Transcript')).toBeVisible({ timeout: 60000 });
    
    // Check that all download format options are available
    await expect(page.locator('text=Download TXT')).toBeVisible();
    await expect(page.locator('text=Download SRT')).toBeVisible();
    await expect(page.locator('text=Download VTT')).toBeVisible();
    await expect(page.locator('text=Download JSON')).toBeVisible();
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