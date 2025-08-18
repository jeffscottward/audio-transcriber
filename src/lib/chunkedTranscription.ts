import { transcribeAudio, type TranscriptionResult, type TranscriptionOptions } from './transcription';
import { chunkAudioFile, type AudioChunk, type ChunkingOptions } from './audioChunker';

export interface ChunkedTranscriptionProgress {
  currentChunk: number;
  totalChunks: number;
  isComplete: boolean;
  error?: string;
  chunks: ChunkTranscriptionResult[];
  currentText?: string; // Real-time text as it's being transcribed
  modelLoading?: boolean;
  modelLoadProgress?: number;
}

export interface ChunkTranscriptionResult {
  chunkIndex: number;
  startTime: number;
  endTime: number;
  text: string;
  error?: string;
}

export interface ChunkedTranscriptionResult {
  fullText: string;
  chunks: ChunkTranscriptionResult[];
  totalDuration: number;
  error?: string;
}

/**
 * Transcribe a large audio file by chunking it first
 */
export async function transcribeAudioInChunks(
  file: File,
  apiKey?: string,
  onProgress?: (progress: ChunkedTranscriptionProgress) => void,
  chunkingOptions?: ChunkingOptions,
  transcriptionOptions?: TranscriptionOptions
): Promise<ChunkedTranscriptionResult> {
  try {
    // First, chunk the audio file
    const chunks = await chunkAudioFile(file, chunkingOptions);
    
    if (chunks.length === 0) {
      throw new Error('No chunks were created from the audio file');
    }

    // If no API key, use local transcription
    const useLocal = !apiKey || transcriptionOptions?.mode === 'local';
    
    if (useLocal) {
      // Dynamic import to avoid SSR issues
      const { transcribeAudioLocallyInChunks } = await import('./localTranscription');
      
      return await transcribeAudioLocallyInChunks(
        chunks.map(chunk => ({
          blob: chunk.blob,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          index: chunk.index
        })),
        (current, total, chunkText) => {
          onProgress?.({
            currentChunk: current,
            totalChunks: total,
            isComplete: current === total,
            chunks: [], // Will be populated at the end
            currentText: chunkText
          });
        }
      ).then(result => {
        const chunkResults = result.chunks?.map((chunk, index) => ({
          chunkIndex: index,
          startTime: chunk.timestamp[0],
          endTime: chunk.timestamp[1],
          text: chunk.text
        })) || [];
        
        return {
          fullText: result.text,
          chunks: chunkResults,
          totalDuration: Math.max(...chunks.map(c => c.endTime)),
          error: result.error
        };
      });
    }

    const chunkResults: ChunkTranscriptionResult[] = [];
    let hasError = false;

    // Process each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Update progress
      onProgress?.({
        currentChunk: i + 1,
        totalChunks: chunks.length,
        isComplete: false,
        chunks: chunkResults
      });

      try {
        // Create a File object from the chunk blob
        const chunkFile = new File(
          [chunk.blob], 
          `${file.name}_chunk_${chunk.index}.wav`,
          { type: 'audio/wav' }
        );

        // Transcribe this chunk with retry logic
        let result: TranscriptionResult | null = null;
        let retries = 0;
        const maxRetries = 2;

        while (retries <= maxRetries) {
          try {
            result = await transcribeAudio(chunkFile, apiKey, transcriptionOptions);
            if (!result.error) {
              break; // Success, exit retry loop
            }
          } catch (retryError) {
            console.warn(`Chunk ${chunk.index} attempt ${retries + 1} failed:`, retryError);
          }
          
          retries++;
          if (retries <= maxRetries) {
            console.log(`Retrying chunk ${chunk.index} (attempt ${retries + 1}/${maxRetries + 1})`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          }
        }
        
        if (result?.error || !result) {
          hasError = true;
          chunkResults.push({
            chunkIndex: chunk.index,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            text: '',
            error: result?.error || `Failed after ${maxRetries + 1} attempts`
          });
        } else {
          chunkResults.push({
            chunkIndex: chunk.index,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            text: result.text
          });
        }
      } catch (error) {
        hasError = true;
        chunkResults.push({
          chunkIndex: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          text: '',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Add a small delay between requests to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Final progress update
    onProgress?.({
      currentChunk: chunks.length,
      totalChunks: chunks.length,
      isComplete: true,
      chunks: chunkResults
    });

    // Combine all successful transcriptions
    const successfulChunks = chunkResults.filter(chunk => !chunk.error);
    const fullText = successfulChunks
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map(chunk => chunk.text.trim())
      .filter(text => text.length > 0)
      .join(' ');

    const totalDuration = Math.max(...chunks.map(c => c.endTime));

    return {
      fullText,
      chunks: chunkResults,
      totalDuration,
      error: hasError ? 'Some chunks failed to transcribe' : undefined
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during chunked transcription';
    
    onProgress?.({
      currentChunk: 0,
      totalChunks: 0,
      isComplete: true,
      error: errorMessage,
      chunks: []
    });

    return {
      fullText: '',
      chunks: [],
      totalDuration: 0,
      error: errorMessage
    };
  }
}

export type TranscriptFormat = 'txt' | 'srt' | 'vtt' | 'json';

/**
 * Generate a downloadable transcript file with timestamps in various formats
 */
export function generateTranscriptFile(
  result: ChunkedTranscriptionResult, 
  fileName: string, 
  format: TranscriptFormat = 'txt'
): { blob: Blob; filename: string } {
  const baseFileName = fileName.replace(/\.[^/.]+$/, '');
  
  switch (format) {
    case 'srt':
      return {
        blob: generateSRTFile(result),
        filename: `${baseFileName}_transcript.srt`
      };
    case 'vtt':
      return {
        blob: generateVTTFile(result),
        filename: `${baseFileName}_transcript.vtt`
      };
    case 'json':
      return {
        blob: generateJSONFile(result, fileName),
        filename: `${baseFileName}_transcript.json`
      };
    default:
      return {
        blob: generateTextFile(result, fileName),
        filename: `${baseFileName}_transcript.txt`
      };
  }
}

function generateTextFile(result: ChunkedTranscriptionResult, fileName: string): Blob {
  let content = `Transcript for: ${fileName}\n`;
  content += `Generated: ${new Date().toLocaleString()}\n`;
  content += `Total Duration: ${formatDuration(result.totalDuration)}\n`;
  content += `\n${'='.repeat(50)}\n\n`;

  if (result.error) {
    content += `⚠️ Warning: ${result.error}\n\n`;
  }

  // Add full transcript
  content += `FULL TRANSCRIPT:\n\n${result.fullText}\n\n`;
  
  // Add detailed chunk breakdown
  content += `${'='.repeat(50)}\n`;
  content += `DETAILED BREAKDOWN BY CHUNKS:\n\n`;
  
  result.chunks.forEach((chunk, index) => {
    const startTime = formatDuration(chunk.startTime);
    const endTime = formatDuration(chunk.endTime);
    
    content += `Chunk ${chunk.chunkIndex + 1} (${startTime} - ${endTime}):\n`;
    
    if (chunk.error) {
      content += `❌ Error: ${chunk.error}\n\n`;
    } else {
      content += `${chunk.text.trim()}\n\n`;
    }
  });

  return new Blob([content], { type: 'text/plain' });
}

function generateSRTFile(result: ChunkedTranscriptionResult): Blob {
  let content = '';
  let subtitleIndex = 1;
  
  result.chunks.forEach((chunk) => {
    if (!chunk.error && chunk.text.trim()) {
      const startTime = formatSRTTime(chunk.startTime);
      const endTime = formatSRTTime(chunk.endTime);
      
      content += `${subtitleIndex}\n`;
      content += `${startTime} --> ${endTime}\n`;
      content += `${chunk.text.trim()}\n\n`;
      subtitleIndex++;
    }
  });
  
  return new Blob([content], { type: 'text/plain' });
}

function generateVTTFile(result: ChunkedTranscriptionResult): Blob {
  let content = 'WEBVTT\n\n';
  
  result.chunks.forEach((chunk) => {
    if (!chunk.error && chunk.text.trim()) {
      const startTime = formatVTTTime(chunk.startTime);
      const endTime = formatVTTTime(chunk.endTime);
      
      content += `${startTime} --> ${endTime}\n`;
      content += `${chunk.text.trim()}\n\n`;
    }
  });
  
  return new Blob([content], { type: 'text/vtt' });
}

function generateJSONFile(result: ChunkedTranscriptionResult, fileName: string): Blob {
  const data = {
    metadata: {
      fileName,
      generated: new Date().toISOString(),
      totalDuration: result.totalDuration,
      error: result.error
    },
    fullText: result.fullText,
    chunks: result.chunks.map(chunk => ({
      index: chunk.chunkIndex,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      text: chunk.text,
      error: chunk.error
    }))
  };
  
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}