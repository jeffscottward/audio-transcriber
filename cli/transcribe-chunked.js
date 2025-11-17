#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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

async function transcribeInChunks() {
  loadEnvFile();
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  
  if (!apiKey) {
    console.error('OpenAI API key not found in .env file');
    process.exit(1);
  }

  // Look for the audio file in results folder
  const sanitizedTitle = 'how_to_actually_use_claude_code_for_trading';
  const videoResultDir = path.join(process.cwd(), 'results', sanitizedTitle);
  const audioFile = path.join(videoResultDir, 'downloads', 'how to actually use claude code for trading.mp3');
  
  if (!fs.existsSync(audioFile)) {
    console.error('Audio file not found:', audioFile);
    process.exit(1);
  }

  console.log('Transcribing large audio file in chunks...');
  console.log('File:', audioFile);
  console.log('Size:', (fs.statSync(audioFile).size / 1024 / 1024).toFixed(1) + 'MB');

  const openai = new OpenAI({ apiKey });
  
  // Create temp directory for chunks in video-specific location
  const tempDir = path.join(videoResultDir, 'temp_chunks');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Get audio duration
    const duration = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioFile}"`,
      { encoding: 'utf-8', shell: true }
    ).trim();
    
    const totalDuration = parseFloat(duration);
    const chunkDuration = 600; // 10 minutes per chunk (well under 25MB limit)
    const numChunks = Math.ceil(totalDuration / chunkDuration);
    
    console.log(`Total duration: ${Math.floor(totalDuration / 60)}:${Math.floor(totalDuration % 60).toString().padStart(2, '0')}`);
    console.log(`Splitting into ${numChunks} chunks of ${chunkDuration / 60} minutes each`);

    // Split audio into chunks
    const chunks = [];
    for (let i = 0; i < numChunks; i++) {
      const startTime = i * chunkDuration;
      const chunkFile = path.join(tempDir, `chunk_${i.toString().padStart(3, '0')}.mp3`);
      
      console.log(`Creating chunk ${i + 1}/${numChunks}...`);
      
      execSync(
        `ffmpeg -i "${audioFile}" -ss ${startTime} -t ${chunkDuration} -c copy "${chunkFile}"`,
        { shell: true, stdio: 'pipe' }
      );
      
      chunks.push({
        file: chunkFile,
        startTime,
        endTime: Math.min(startTime + chunkDuration, totalDuration),
        index: i
      });
    }

    // Transcribe each chunk
    console.log('\nTranscribing chunks...');
    const transcriptions = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);
      
      const fileStream = fs.createReadStream(chunk.file);
      
      try {
        const response = await openai.audio.transcriptions.create({
          file: fileStream,
          model: 'whisper-1',
          response_format: 'verbose_json'
        });
        
        // Adjust segment timestamps to global time
        if (response.segments) {
          response.segments.forEach(segment => {
            segment.start += chunk.startTime;
            segment.end += chunk.startTime;
          });
        }
        
        transcriptions.push({
          chunkIndex: i,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          text: response.text,
          segments: response.segments || []
        });
        
        console.log(`  Chunk ${i + 1} complete (${response.text.substring(0, 50)}...)`);
        
      } catch (error) {
        console.error(`Error transcribing chunk ${i + 1}:`, error.message);
        transcriptions.push({
          chunkIndex: i,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          text: `[Error transcribing chunk ${i + 1}: ${error.message}]`,
          segments: []
        });
      }
    }

    // Combine transcriptions
    const fullText = transcriptions.map(t => t.text).join(' ');
    const allSegments = transcriptions.flatMap(t => t.segments);

    // Use existing directory structure (already created)
    const transcriptsDir = path.join(videoResultDir, 'transcripts');
    fs.mkdirSync(transcriptsDir, { recursive: true });

    // Audio file is already in the correct location, no need to copy

    // Save transcripts
    const files = {};

    // Plain text
    fs.writeFileSync(path.join(transcriptsDir, 'transcript.txt'), fullText);
    files.txt = path.join(transcriptsDir, 'transcript.txt');

    // JSON with metadata
    const jsonContent = {
      metadata: {
        title: 'How to Actually Use Claude Code for Trading',
        duration: `${Math.floor(totalDuration / 60)}:${Math.floor(totalDuration % 60).toString().padStart(2, '0')}`,
        videoId: 'Tvs3wEt2H8I',
        url: 'https://www.youtube.com/watch?v=Tvs3wEt2H8I',
        transcribedAt: new Date().toISOString(),
        chunked: true,
        numChunks: numChunks
      },
      transcription: {
        text: fullText,
        segments: allSegments,
        chunks: transcriptions
      }
    };
    fs.writeFileSync(path.join(transcriptsDir, 'transcript.json'), JSON.stringify(jsonContent, null, 2));
    files.json = path.join(transcriptsDir, 'transcript.json');

    // Generate SRT if segments available
    if (allSegments.length > 0) {
      const srt = generateSRT(allSegments);
      fs.writeFileSync(path.join(transcriptsDir, 'transcript.srt'), srt);
      files.srt = path.join(transcriptsDir, 'transcript.srt');

      const vtt = generateVTT(allSegments);
      fs.writeFileSync(path.join(transcriptsDir, 'transcript.vtt'), vtt);
      files.vtt = path.join(transcriptsDir, 'transcript.vtt');
    }

    // Cleanup temp files
    fs.rmSync(tempDir, { recursive: true });

    console.log('\n=== Transcription Complete ===');
    console.log('Title: How to Actually Use Claude Code for Trading');
    console.log(`Duration: ${Math.floor(totalDuration / 60)}:${Math.floor(totalDuration % 60).toString().padStart(2, '0')}`);
    console.log('Video ID: Tvs3wEt2H8I');
    console.log(`Results directory: ${videoResultDir}`);
    console.log(`Processed in ${numChunks} chunks`);
    console.log('\nGenerated files:');
    Object.entries(files).forEach(([format, filepath]) => {
      console.log(`  ${format.toUpperCase()}: ${path.basename(filepath)}`);
    });

    console.log('\nFirst 200 characters of transcript:');
    console.log(fullText.substring(0, 200) + '...');

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

transcribeInChunks();