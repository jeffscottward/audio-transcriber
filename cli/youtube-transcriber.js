#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const OpenAI = require('openai');
const readline = require('readline');

// Load environment variables from .env file
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

class YouTubeTranscriber {
  constructor() {
    // Load .env file first
    loadEnvFile();
    
    // Try both OPENAI_API_KEY and OPENAI_KEY
    this.openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
    this.resultsDir = path.join(process.cwd(), 'results');
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  createVideoDirectories(sanitizedTitle) {
    const videoResultDir = path.join(this.resultsDir, sanitizedTitle);
    const downloadsDir = path.join(videoResultDir, 'downloads');
    const transcriptsDir = path.join(videoResultDir, 'transcripts');
    
    if (!fs.existsSync(videoResultDir)) {
      fs.mkdirSync(videoResultDir, { recursive: true });
    }
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    if (!fs.existsSync(transcriptsDir)) {
      fs.mkdirSync(transcriptsDir, { recursive: true });
    }
    
    return { videoResultDir, downloadsDir, transcriptsDir };
  }

  extractVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  sanitizeFileName(filename) {
    return filename
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s/g, '_');
  }

  async downloadAudio(youtubeUrl) {
    console.log('Downloading audio from YouTube...');
    
    try {
      const videoId = this.extractVideoId(youtubeUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Create video-specific directories first
      const tempTitle = this.extractVideoId(youtubeUrl) || 'temp_video';
      const { videoResultDir, downloadsDir } = this.createVideoDirectories(tempTitle);
      
      // Get video metadata and download directly to video folder
      const output = execSync(
        `yt-dlp --extract-audio --audio-format mp3 --get-title --get-duration "${youtubeUrl}"`,
        { encoding: 'utf-8', cwd: downloadsDir, shell: true }
      ).trim().split('\n');
      
      const title = output[0];
      const duration = output[1];
      const sanitizedTitle = this.sanitizeFileName(title);
      
      // Rename directory if title is different from video ID
      if (tempTitle !== sanitizedTitle) {
        const newVideoResultDir = path.join(this.resultsDir, sanitizedTitle);
        if (fs.existsSync(newVideoResultDir)) {
          fs.rmSync(newVideoResultDir, { recursive: true });
        }
        fs.renameSync(videoResultDir, newVideoResultDir);
        const newDirs = this.createVideoDirectories(sanitizedTitle);
        Object.assign({ videoResultDir, downloadsDir }, newDirs);
      }
      
      // Download audio to video-specific folder only
      execSync(
        `yt-dlp --extract-audio --audio-format mp3 --output "${sanitizedTitle}.%(ext)s" "${youtubeUrl}"`,
        { cwd: downloadsDir, shell: true }
      );

      const audioFile = path.join(downloadsDir, `${sanitizedTitle}.mp3`);
      
      return {
        audioFile,
        title,
        duration,
        videoId,
        sanitizedTitle,
        videoResultDir,
        downloadsDir
      };
    } catch (error) {
      throw new Error(`Failed to download audio: ${error.message}`);
    }
  }

  async transcribeAudio(audioFile) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable.');
    }

    console.log('Transcribing audio with OpenAI Whisper...');
    
    const openai = new OpenAI({
      apiKey: this.openaiApiKey,
    });

    const fileStream = fs.createReadStream(audioFile);
    const fileSizeInBytes = fs.statSync(audioFile).size;
    const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

    if (fileSizeInMB > 25) {
      throw new Error('Audio file is too large (>25MB). Please use chunked transcription.');
    }

    try {
      const response = await openai.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        response_format: 'verbose_json'
      });

      return response;
    } catch (error) {
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  generateSRT(segments) {
    let srt = '';
    segments.forEach((segment, index) => {
      const start = this.formatSRTTime(segment.start || 0);
      const end = this.formatSRTTime(segment.end || segment.start + 2);
      srt += `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}\n\n`;
    });
    return srt;
  }

  generateVTT(segments) {
    let vtt = 'WEBVTT\n\n';
    segments.forEach((segment) => {
      const start = this.formatVTTTime(segment.start || 0);
      const end = this.formatVTTTime(segment.end || segment.start + 2);
      vtt += `${start} --> ${end}\n${segment.text.trim()}\n\n`;
    });
    return vtt;
  }

  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  formatVTTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  async saveTranscripts(transcription, metadata) {
    const { sanitizedTitle, title, duration, videoId, videoResultDir } = metadata;
    const transcriptDir = path.join(videoResultDir, 'transcripts');

    const files = {};

    // Save plain text
    const txtContent = transcription.text;
    const txtFile = path.join(transcriptDir, 'transcript.txt');
    fs.writeFileSync(txtFile, txtContent);
    files.txt = txtFile;

    // Save JSON with metadata
    const jsonContent = {
      metadata: {
        title,
        duration,
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        transcribedAt: new Date().toISOString()
      },
      transcription: transcription
    };
    const jsonFile = path.join(transcriptDir, 'transcript.json');
    fs.writeFileSync(jsonFile, JSON.stringify(jsonContent, null, 2));
    files.json = jsonFile;

    // Generate and save SRT (if segments available)
    if (transcription.segments && transcription.segments.length > 0) {
      const srtContent = this.generateSRT(transcription.segments);
      const srtFile = path.join(transcriptDir, 'transcript.srt');
      fs.writeFileSync(srtFile, srtContent);
      files.srt = srtFile;

      // Generate and save VTT
      const vttContent = this.generateVTT(transcription.segments);
      const vttFile = path.join(transcriptDir, 'transcript.vtt');
      fs.writeFileSync(vttFile, vttContent);
      files.vtt = vttFile;
    }

    return { transcriptDir, files };
  }

  async processYouTubeUrl(youtubeUrl) {
    try {
      console.log(`Processing YouTube URL: ${youtubeUrl}`);
      
      // Download audio
      const audioData = await this.downloadAudio(youtubeUrl);
      console.log(`Audio downloaded: ${audioData.title}`);
      
      // Transcribe audio
      const transcription = await this.transcribeAudio(audioData.audioFile);
      console.log('Transcription completed!');
      
      // Save all transcript formats
      const { transcriptDir, files } = await this.saveTranscripts(transcription, audioData);
      
      console.log('\n=== Transcription Complete ===');
      console.log(`Title: ${audioData.title}`);
      console.log(`Duration: ${audioData.duration}`);
      console.log(`Transcript directory: ${transcriptDir}`);
      console.log('\nGenerated files:');
      Object.entries(files).forEach(([format, filepath]) => {
        console.log(`  ${format.toUpperCase()}: ${path.basename(filepath)}`);
      });
      
      return { transcriptDir, files, metadata: audioData };
      
    } catch (error) {
      console.error('Error:', error.message);
      throw error;
    }
  }

  async promptForApiKey() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('Enter your OpenAI API key: ', (apiKey) => {
        rl.close();
        this.openaiApiKey = apiKey.trim();
        resolve(apiKey.trim());
      });
    });
  }
}

// CLI Usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node youtube-transcriber.js <youtube_url>');
    console.log('Example: node youtube-transcriber.js https://www.youtube.com/watch?v=VIDEO_ID');
    process.exit(1);
  }

  const youtubeUrl = args[0];
  const transcriber = new YouTubeTranscriber();

  // Check if API key is available
  if (!transcriber.openaiApiKey) {
    console.log('OpenAI API key not found in environment variables.');
    await transcriber.promptForApiKey();
  }

  try {
    await transcriber.processYouTubeUrl(youtubeUrl);
  } catch (error) {
    console.error('Failed to process YouTube URL:', error.message);
    process.exit(1);
  }
}

// Export for use as module
module.exports = YouTubeTranscriber;

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}