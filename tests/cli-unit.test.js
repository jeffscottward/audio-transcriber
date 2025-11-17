#!/usr/bin/env node

const YouTubeTranscriber = require('../cli/youtube-transcriber.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Simple test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(description, testFn) {
    this.tests.push({ description, testFn });
  }

  async run() {
    console.log(`\n🧪 Running ${this.tests.length} CLI unit tests...\n`);

    for (const { description, testFn } of this.tests) {
      try {
        await testFn();
        console.log(`✅ ${description}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${description}`);
        console.log(`   Error: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results:`);
    console.log(`   Passed: ${this.passed}`);
    console.log(`   Failed: ${this.failed}`);
    console.log(`   Total: ${this.tests.length}\n`);

    return this.failed === 0;
  }
}

// Assertion helpers
function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} - Expected: ${expected}, Got: ${actual}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} - Expected truthy value, got: ${value}`);
  }
}

function assertExists(filePath, message = '') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${message} - File does not exist: ${filePath}`);
  }
}

// Test suite
const runner = new TestRunner();

runner.test('should extract YouTube video IDs correctly', () => {
  const transcriber = new YouTubeTranscriber();

  assertEqual(
    transcriber.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'dQw4w9WgXcQ',
    'Standard YouTube URL'
  );

  assertEqual(
    transcriber.extractVideoId('https://youtu.be/dQw4w9WgXcQ'),
    'dQw4w9WgXcQ',
    'Short YouTube URL'
  );

  assertEqual(
    transcriber.extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'),
    'dQw4w9WgXcQ',
    'Embed YouTube URL'
  );

  assertEqual(
    transcriber.extractVideoId('https://vimeo.com/123456'),
    null,
    'Invalid URL should return null'
  );
});

runner.test('should sanitize file names correctly', () => {
  const transcriber = new YouTubeTranscriber();

  assertEqual(
    transcriber.sanitizeFileName('Hello World! @#$%'),
    'Hello_World',
    'Remove special characters'
  );

  assertEqual(
    transcriber.sanitizeFileName('Test (2024) - Part 1'),
    'Test_2024_-_Part_1',
    'Handle parentheses and dashes'
  );

  assertEqual(
    transcriber.sanitizeFileName('   Multiple   Spaces   '),
    'Multiple_Spaces',
    'Normalize spaces'
  );
});

runner.test('should format SRT timestamps correctly', () => {
  const transcriber = new YouTubeTranscriber();

  assertEqual(
    transcriber.formatSRTTime(0),
    '00:00:00,000',
    'Zero seconds'
  );

  assertEqual(
    transcriber.formatSRTTime(65.5),
    '00:01:05,500',
    'Minutes and milliseconds'
  );

  assertEqual(
    transcriber.formatSRTTime(3661.750),
    '01:01:01,750',
    'Hours, minutes, seconds, milliseconds'
  );
});

runner.test('should format VTT timestamps correctly', () => {
  const transcriber = new YouTubeTranscriber();

  assertEqual(
    transcriber.formatVTTTime(0),
    '00:00:00.000',
    'Zero seconds VTT format'
  );

  assertEqual(
    transcriber.formatVTTTime(65.5),
    '00:01:05.500',
    'VTT format with dot separator'
  );
});

runner.test('should generate SRT format correctly', () => {
  const transcriber = new YouTubeTranscriber();
  const segments = [
    { text: 'Hello world', start: 0, end: 2 },
    { text: 'This is a test', start: 2, end: 5 }
  ];

  const srt = transcriber.generateSRT(segments);
  
  assertTrue(
    srt.includes('1\n00:00:00,000 --> 00:00:02,000\nHello world\n\n'),
    'First SRT segment'
  );
  
  assertTrue(
    srt.includes('2\n00:00:02,000 --> 00:00:05,000\nThis is a test\n\n'),
    'Second SRT segment'
  );
});

runner.test('should generate VTT format correctly', () => {
  const transcriber = new YouTubeTranscriber();
  const segments = [
    { text: 'Hello world', start: 0, end: 2 },
    { text: 'This is a test', start: 2, end: 5 }
  ];

  const vtt = transcriber.generateVTT(segments);
  
  assertTrue(vtt.startsWith('WEBVTT\n\n'), 'VTT header');
  assertTrue(
    vtt.includes('00:00:00.000 --> 00:00:02.000\nHello world\n\n'),
    'VTT segment format'
  );
});

runner.test('should create proper directory structure', () => {
  const transcriber = new YouTubeTranscriber();
  
  assertExists(transcriber.resultsDir, 'Results directory should exist');
});

runner.test('should create video-specific directories', () => {
  const transcriber = new YouTubeTranscriber();
  const testTitle = 'test_video_title';
  
  const { videoResultDir, downloadsDir, transcriptsDir } = transcriber.createVideoDirectories(testTitle);
  
  assertExists(videoResultDir, 'Video result directory should exist');
  assertExists(downloadsDir, 'Video downloads directory should exist');
  assertExists(transcriptsDir, 'Video transcripts directory should exist');
  
  // Cleanup
  if (fs.existsSync(videoResultDir)) {
    fs.rmSync(videoResultDir, { recursive: true });
  }
});

runner.test('should validate CLI script exists and is executable', () => {
  const cliPath = path.join(__dirname, '../cli/youtube-transcriber.js');
  
  assertExists(cliPath, 'CLI script should exist');
  
  const stats = fs.statSync(cliPath);
  assertTrue(stats.isFile(), 'CLI path should be a file');
  
  // Check executable permissions on Unix systems
  if (process.platform !== 'win32') {
    assertTrue(
      stats.mode & parseInt('111', 8),
      'CLI script should be executable'
    );
  }
});

runner.test('should show usage when run without arguments', () => {
  const cliPath = path.join(__dirname, '../cli/youtube-transcriber.js');
  
  try {
    execSync(`node "${cliPath}"`, { stdio: 'pipe' });
    throw new Error('CLI should exit with error when no arguments provided');
  } catch (error) {
    assertEqual(error.status, 1, 'Should exit with status code 1');
    
    const output = error.stdout?.toString() || '';
    assertTrue(
      output.includes('Usage:') || output.includes('Example:'),
      'Should show usage information'
    );
  }
});

// Run the tests
if (require.main === module) {
  runner.run().then((success) => {
    process.exit(success ? 0 : 1);
  });
}