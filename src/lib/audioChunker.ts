/**
 * Audio chunking utility for handling large files
 */

export interface AudioChunk {
  blob: Blob;
  startTime: number;
  endTime: number;
  index: number;
}

export interface ChunkingOptions {
  chunkDurationSeconds: number;
  overlapSeconds?: number;
  maxChunkSize?: number; // in bytes
}

/**
 * Split an audio file into smaller chunks for processing
 */
export async function chunkAudioFile(
  file: File,
  options: ChunkingOptions = {
    chunkDurationSeconds: 300, // 5 minutes default
    overlapSeconds: 5,
    maxChunkSize: 20 * 1024 * 1024 // 20MB max per chunk
  }
): Promise<AudioChunk[]> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const fileReader = new FileReader();

    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const chunks = createAudioChunks(audioBuffer, file.type, options, audioContext);
        
        // Close the audio context when done
        await audioContext.close();
        resolve(chunks);
      } catch (error) {
        // Close context on error too
        await audioContext.close().catch(() => {});
        reject(new Error(`Failed to process audio file: ${error}`));
      }
    };

    fileReader.onerror = () => {
      reject(new Error('Failed to read audio file'));
    };

    fileReader.readAsArrayBuffer(file);
  });
}

function createAudioChunks(
  audioBuffer: AudioBuffer,
  mimeType: string,
  options: ChunkingOptions,
  audioContext: AudioContext
): AudioChunk[] {
  const chunks: AudioChunk[] = [];
  const sampleRate = audioBuffer.sampleRate;
  const totalDuration = audioBuffer.duration;
  let chunkDuration = options.chunkDurationSeconds;
  const overlap = options.overlapSeconds || 0;
  const maxChunkSize = options.maxChunkSize || 20 * 1024 * 1024; // 20MB default
  
  // Calculate actual WAV bytes per second (we always convert to WAV)
  const bytesPerSecond = sampleRate * audioBuffer.numberOfChannels * 2; // 16-bit PCM
  const wavHeaderSize = 44;
  
  // Calculate maximum safe duration for the size limit with safety margin
  const safeMaxChunkSize = maxChunkSize * 0.95; // 5% safety margin
  const maxDurationForSize = Math.floor((safeMaxChunkSize - wavHeaderSize) / bytesPerSecond);
  
  // Always use the calculated safe duration, regardless of user preference
  const safeDuration = Math.min(chunkDuration, maxDurationForSize);
  chunkDuration = Math.max(5, safeDuration); // minimum 5 seconds
  
  console.log(`Using chunk duration of ${chunkDuration}s to stay under ${maxChunkSize / 1024 / 1024}MB limit (estimated size: ${((chunkDuration * bytesPerSecond + wavHeaderSize) / 1024 / 1024).toFixed(1)}MB)`);
  
  // Verify our calculation doesn't exceed the limit
  const estimatedSize = (chunkDuration * bytesPerSecond) + wavHeaderSize;
  if (estimatedSize > maxChunkSize) {
    throw new Error(`Chunk size calculation error: estimated ${estimatedSize} bytes exceeds ${maxChunkSize} limit`);
  }
  
  let currentTime = 0;
  let chunkIndex = 0;

  while (currentTime < totalDuration) {
    const startTime = Math.max(0, currentTime - overlap);
    const endTime = Math.min(totalDuration, currentTime + chunkDuration);
    
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const frameCount = endSample - startSample;

    // Create new audio buffer for this chunk using the existing context
    const chunkBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      frameCount,
      sampleRate
    );

    // Copy audio data for each channel
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const sourceData = audioBuffer.getChannelData(channel);
      const chunkData = chunkBuffer.getChannelData(channel);
      
      for (let i = 0; i < frameCount; i++) {
        chunkData[i] = sourceData[startSample + i] || 0;
      }
    }

    // Convert to blob
    const blob = audioBufferToBlob(chunkBuffer, mimeType);
    
    // Double-check the actual blob size
    if (blob.size > maxChunkSize) {
      console.warn(`Chunk ${chunkIndex} is ${blob.size} bytes, exceeding ${maxChunkSize} limit`);
    }
    
    chunks.push({
      blob,
      startTime: currentTime,
      endTime,
      index: chunkIndex
    });

    currentTime += chunkDuration;
    chunkIndex++;
  }

  return chunks;
}

function audioBufferToBlob(audioBuffer: AudioBuffer, mimeType: string): Blob {
  const length = audioBuffer.length;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  
  // Create WAV file data
  const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(buffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}