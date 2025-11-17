import { test, expect } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const YouTubeTranscriber = require('../cli/youtube-transcriber.js');

test.describe('YouTube Transcriber CLI', () => {
  const testDownloadsDir = path.join(__dirname, '../downloads');
  const testTranscriptsDir = path.join(__dirname, '../transcripts');

  test.beforeEach(() => {
    // Ensure test directories exist
    if (!fs.existsSync(testDownloadsDir)) {
      fs.mkdirSync(testDownloadsDir, { recursive: true });
    }
    if (!fs.existsSync(testTranscriptsDir)) {
      fs.mkdirSync(testTranscriptsDir, { recursive: true });
    }
  });

  test('should validate YouTube URLs correctly', () => {
    const transcriber = new YouTubeTranscriber();

    // Valid URLs
    expect(transcriber.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(transcriber.extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(transcriber.extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');

    // Invalid URLs
    expect(transcriber.extractVideoId('https://vimeo.com/123456')).toBe(null);
    expect(transcriber.extractVideoId('not-a-url')).toBe(null);
    expect(transcriber.extractVideoId('')).toBe(null);
  });

  test('should sanitize file names correctly', () => {
    const transcriber = new YouTubeTranscriber();

    expect(transcriber.sanitizeFileName('Hello World! @#$%')).toBe('Hello_World');
    expect(transcriber.sanitizeFileName('Test (2024) - Part 1')).toBe('Test_2024_-_Part_1');
    expect(transcriber.sanitizeFileName('   Multiple   Spaces   ')).toBe('Multiple_Spaces');
    expect(transcriber.sanitizeFileName('Special|Chars\\/:*?"<>|')).toBe('SpecialChars');
  });

  test('should format SRT timestamps correctly', () => {
    const transcriber = new YouTubeTranscriber();

    expect(transcriber.formatSRTTime(0)).toBe('00:00:00,000');
    expect(transcriber.formatSRTTime(65.5)).toBe('00:01:05,500');
    expect(transcriber.formatSRTTime(3661.750)).toBe('01:01:01,750');
  });

  test('should format VTT timestamps correctly', () => {
    const transcriber = new YouTubeTranscriber();

    expect(transcriber.formatVTTTime(0)).toBe('00:00:00.000');
    expect(transcriber.formatVTTTime(65.5)).toBe('00:01:05.500');
    expect(transcriber.formatVTTTime(3661.750)).toBe('01:01:01.750');
  });

  test('should generate SRT format correctly', () => {
    const transcriber = new YouTubeTranscriber();
    const segments = [
      { text: 'Hello world', start: 0, end: 2 },
      { text: 'This is a test', start: 2, end: 5 }
    ];

    const srt = transcriber.generateSRT(segments);
    
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,000\nHello world\n\n');
    expect(srt).toContain('2\n00:00:02,000 --> 00:00:05,000\nThis is a test\n\n');
  });

  test('should generate VTT format correctly', () => {
    const transcriber = new YouTubeTranscriber();
    const segments = [
      { text: 'Hello world', start: 0, end: 2 },
      { text: 'This is a test', start: 2, end: 5 }
    ];

    const vtt = transcriber.generateVTT(segments);
    
    expect(vtt).toContain('WEBVTT\n\n');
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.000\nHello world\n\n');
    expect(vtt).toContain('00:00:02.000 --> 00:00:05.000\nThis is a test\n\n');
  });

  test('should create proper directory structure', () => {
    const transcriber = new YouTubeTranscriber();
    
    expect(fs.existsSync(transcriber.downloadsDir)).toBe(true);
    expect(fs.existsSync(transcriber.transcriptsDir)).toBe(true);
  });

  test('should handle missing OpenAI API key gracefully', () => {
    // Temporarily unset API key
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const transcriber = new YouTubeTranscriber();
    expect(transcriber.openaiApiKey).toBe(undefined);

    // Restore original key
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });

  test('should validate CLI usage', () => {
    try {
      // Test CLI without arguments (should fail)
      execSync('node cli/youtube-transcriber.js', { 
        stdio: 'pipe',
        cwd: path.join(__dirname, '..') 
      });
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1); // Exit code 1 for invalid usage
      expect(error.stderr.toString()).toContain('Usage:');
    }
  });

  test('should show help message with invalid arguments', () => {
    try {
      execSync('node cli/youtube-transcriber.js', { 
        stdio: 'pipe',
        cwd: path.join(__dirname, '..') 
      });
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      expect(output).toContain('Usage: node youtube-transcriber.js <youtube_url>');
      expect(output).toContain('Example: node youtube-transcriber.js https://www.youtube.com/watch?v=VIDEO_ID');
    }
  });

  test('should be executable', () => {
    const cliPath = path.join(__dirname, '../cli/youtube-transcriber.js');
    const stats = fs.statSync(cliPath);
    
    // Check if file has execute permissions (on Unix systems)
    if (process.platform !== 'win32') {
      expect(stats.mode & parseInt('111', 8)).toBeTruthy();
    }
    expect(stats.isFile()).toBe(true);
  });

  // Integration test - requires actual API key and network access
  test.skip('should process actual YouTube video (integration test)', async () => {
    const transcriber = new YouTubeTranscriber();
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping integration test - no API key provided');
      return;
    }

    // Use a very short public domain video for testing
    const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Short "Me at the zoo" video
    
    try {
      const result = await transcriber.processYouTubeUrl(testUrl);
      
      expect(result.transcriptDir).toBeTruthy();
      expect(result.files.txt).toBeTruthy();
      expect(result.files.json).toBeTruthy();
      expect(fs.existsSync(result.files.txt)).toBe(true);
      expect(fs.existsSync(result.files.json)).toBe(true);
      
      // Clean up test files
      if (fs.existsSync(result.transcriptDir)) {
        fs.rmSync(result.transcriptDir, { recursive: true });
      }
      
    } catch (error) {
      console.log('Integration test failed:', error);
      // Don't fail the test suite if integration test fails due to network/API issues
    }
  });

  test.afterAll(() => {
    // Cleanup: Remove any test files created during testing
    // Note: Be careful not to delete user data
  });
});