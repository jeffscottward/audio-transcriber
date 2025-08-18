// Since local AI models are causing ONNX runtime issues in browsers,
// we'll focus on optimized OpenAI API usage with better chunking

export interface LocalTranscriptionProgress {
  status: 'loading' | 'processing' | 'complete' | 'error';
  progress?: number;
  text?: string;
  error?: string;
}

export interface LocalTranscriptionResult {
  text: string;
  chunks?: Array<{
    text: string;
    timestamp: [number, number];
  }>;
  error?: string;
}

/**
 * Simulate transcription for demo purposes when no API key is provided
 */
export async function transcribeAudioLocally(
  audioBlob: Blob,
  onProgress?: (progress: LocalTranscriptionProgress) => void
): Promise<LocalTranscriptionResult> {
  onProgress?.({ status: 'processing', progress: 0 });

  // Simulate processing time based on file size
  const fileSizeMB = audioBlob.size / (1024 * 1024);
  const processingTimeMs = Math.min(fileSizeMB * 500, 5000); // Max 5 seconds
  
  // Simulate progress
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    await new Promise(resolve => setTimeout(resolve, processingTimeMs / steps));
    onProgress?.({ 
      status: 'processing', 
      progress: Math.round((i / steps) * 100) 
    });
  }

  onProgress?.({ status: 'complete', progress: 100 });

  // Return a helpful message explaining the situation
  const fileName = audioBlob.type.includes('video') ? 'video file' : 'audio file';
  
  return {
    text: `This is a simulated transcription for your ${fileName} (${fileSizeMB.toFixed(1)}MB).

🤖 Local AI transcription is currently experiencing technical difficulties with browser compatibility.

💡 For accurate transcription, please:
1. Add your OpenAI API key above
2. Upload your file again for real AI-powered transcription

✨ With an API key, you'll get:
- High-quality Whisper AI transcription
- Support for 50+ languages
- Automatic chunking for large files
- Multiple download formats (TXT, SRT, VTT, JSON)

The chunking algorithm has been optimized to minimize API costs by staying under the 25MB limit per request.`,
    chunks: [{
      text: `Simulated transcription for ${fileName}`,
      timestamp: [0, 60] as [number, number]
    }]
  };
}

/**
 * Transcribe audio in chunks (simulation)
 */
export async function transcribeAudioLocallyInChunks(
  chunks: Array<{ blob: Blob; startTime: number; endTime: number; index: number }>,
  onProgress?: (current: number, total: number, chunkText?: string) => void
): Promise<LocalTranscriptionResult> {
  const transcribedChunks: Array<{
    text: string;
    timestamp: [number, number];
    index: number;
  }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    onProgress?.(i + 1, chunks.length);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    const chunkText = `Simulated transcription for chunk ${chunk.index + 1} (${chunk.startTime.toFixed(1)}s - ${chunk.endTime.toFixed(1)}s)`;
    
    transcribedChunks.push({
      text: chunkText,
      timestamp: [chunk.startTime, chunk.endTime],
      index: chunk.index
    });
    
    onProgress?.(i + 1, chunks.length, chunkText);
  }

  // Combine all transcriptions
  const fullText = `This is a simulated transcription for your large audio file split into ${chunks.length} chunks.

🤖 Local AI transcription is currently experiencing technical difficulties.

💡 For accurate transcription:
1. Add your OpenAI API key above
2. The file will be automatically processed in optimized chunks
3. Download your transcript in multiple formats

✨ Benefits of using OpenAI API:
- Professional-grade Whisper AI
- Support for 50+ languages  
- Optimized chunking (under 25MB per request)
- Real-time progress tracking
- Multiple export formats

${transcribedChunks.map(chunk => `• ${chunk.text}`).join('\n')}`;

  return {
    text: fullText,
    chunks: transcribedChunks.map(chunk => ({
      text: chunk.text,
      timestamp: chunk.timestamp
    }))
  };
}

/**
 * Initialize local transcription (now just returns immediately)
 */
export async function initializeLocalWhisper(
  onProgress?: (progress: LocalTranscriptionProgress) => void
): Promise<void> {
  onProgress?.({ 
    status: 'complete', 
    progress: 100,
    text: 'Demo mode ready - add OpenAI API key for real transcription'
  });
}

/**
 * Check if local Whisper is ready (always false now)
 */
export function isLocalWhisperReady(): boolean {
  return false;
}

/**
 * Get info about transcription options
 */
export function getModelInfo() {
  return {
    model: 'OpenAI Whisper (recommended)',
    estimatedSize: 'No download required',
    languages: ['50+ languages supported'],
    description: 'Professional-grade transcription via API'
  };
}