#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Load .env file
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    });
  }
}

async function transcribeExistingFile() {
  loadEnvFile();
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  
  if (!apiKey) {
    console.error('OpenAI API key not found in .env file');
    process.exit(1);
  }

  const audioFile = './downloads/how_to_actually_use_claude_code_for_trading.mp3';
  
  if (!fs.existsSync(audioFile)) {
    console.error('Audio file not found:', audioFile);
    process.exit(1);
  }

  console.log('Transcribing existing audio file...');
  console.log('File:', audioFile);
  console.log('Size:', (fs.statSync(audioFile).size / 1024 / 1024).toFixed(1) + 'MB');

  const openai = new OpenAI({ apiKey });

  try {
    const fileStream = fs.createReadStream(audioFile);
    
    const response = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'verbose_json'
    });

    // Create results directory structure
    const sanitizedTitle = 'how_to_actually_use_claude_code_for_trading';
    const videoResultDir = path.join(process.cwd(), 'results', sanitizedTitle);
    const downloadsDir = path.join(videoResultDir, 'downloads');
    const transcriptsDir = path.join(videoResultDir, 'transcripts');
    
    fs.mkdirSync(downloadsDir, { recursive: true });
    fs.mkdirSync(transcriptsDir, { recursive: true });

    // Copy audio file to new location
    fs.copyFileSync(audioFile, path.join(downloadsDir, 'how_to_actually_use_claude_code_for_trading.mp3'));

    // Save transcripts
    const files = {};

    // Plain text
    fs.writeFileSync(path.join(transcriptsDir, 'transcript.txt'), response.text);
    files.txt = path.join(transcriptsDir, 'transcript.txt');

    // JSON with metadata
    const jsonContent = {
      metadata: {
        title: 'How to Actually Use Claude Code for Trading',
        videoId: 'Tvs3wEt2H8I',
        url: 'https://www.youtube.com/watch?v=Tvs3wEt2H8I',
        transcribedAt: new Date().toISOString()
      },
      transcription: response
    };
    fs.writeFileSync(path.join(transcriptsDir, 'transcript.json'), JSON.stringify(jsonContent, null, 2));
    files.json = path.join(transcriptsDir, 'transcript.json');

    // Generate SRT if segments available
    if (response.segments && response.segments.length > 0) {
      const srt = generateSRT(response.segments);
      fs.writeFileSync(path.join(transcriptsDir, 'transcript.srt'), srt);
      files.srt = path.join(transcriptsDir, 'transcript.srt');

      const vtt = generateVTT(response.segments);
      fs.writeFileSync(path.join(transcriptsDir, 'transcript.vtt'), vtt);
      files.vtt = path.join(transcriptsDir, 'transcript.vtt');
    }

    console.log('\n=== Transcription Complete ===');
    console.log('Title: How to Actually Use Claude Code for Trading');
    console.log('Video ID: Tvs3wEt2H8I');
    console.log(`Results directory: ${videoResultDir}`);
    console.log('\nGenerated files:');
    Object.entries(files).forEach(([format, filepath]) => {
      console.log(`  ${format.toUpperCase()}: ${path.basename(filepath)}`);
    });

  } catch (error) {
    console.error('Transcription failed:', error.message);
    process.exit(1);
  }
}

function generateSRT(segments) {
  let srt = '';
  segments.forEach((segment, index) => {
    const start = formatSRTTime(segment.start || 0);
    const end = formatSRTTime(segment.end || segment.start + 2);
    srt += `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}\n\n`;
  });
  return srt;
}

function generateVTT(segments) {
  let vtt = 'WEBVTT\n\n';
  segments.forEach((segment) => {
    const start = formatVTTTime(segment.start || 0);
    const end = formatVTTTime(segment.end || segment.start + 2);
    vtt += `${start} --> ${end}\n${segment.text.trim()}\n\n`;
  });
  return vtt;
}

function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatVTTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

transcribeExistingFile();