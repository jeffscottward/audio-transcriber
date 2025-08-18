import OpenAI from 'openai';

// Create a type for the transcription result
export type TranscriptionResult = {
  text: string;
  language?: string;
  duration?: number;
  error?: string;
};

export type TranscriptionMode = 'openai' | 'local' | 'auto';

export interface LocalTranscriptionProgress {
  status: 'loading' | 'processing' | 'complete' | 'error';
  progress?: number;
  text?: string;
  error?: string;
}

export interface TranscriptionOptions {
  mode?: TranscriptionMode;
  onLocalProgress?: (progress: LocalTranscriptionProgress) => void;
}

/**
 * Transcribe an audio file using OpenAI's Whisper model or local Whisper
 */
export async function transcribeAudio(
  file: File,
  apiKey?: string,
  options?: TranscriptionOptions
): Promise<TranscriptionResult> {
  const mode = options?.mode || (apiKey ? 'openai' : 'local');
  
  // If no API key and mode is auto/openai, fall back to local
  if (mode === 'openai' && !apiKey) {
    return transcribeAudioLocal(file, options);
  }
  
  // If mode is local or no API key, use local transcription
  if (mode === 'local' || !apiKey) {
    return transcribeAudioLocal(file, options);
  }

  try {
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Transcription request timed out after 60 seconds'));
      }, 60000); // 60 second timeout
    });

    const transcriptionPromise = openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });

    const response = await Promise.race([transcriptionPromise, timeoutPromise]);

    return {
      text: response.text,
    };
  } catch (error) {
    console.error('Transcription error:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown transcription error',
    };
  }
}

/**
 * Transcribe audio using local Whisper model
 */
async function transcribeAudioLocal(
  file: File,
  options?: TranscriptionOptions
): Promise<TranscriptionResult> {
  try {
    // Dynamic import to avoid SSR issues
    const { transcribeAudioLocally } = await import('./localTranscription');
    const result = await transcribeAudioLocally(file, options?.onLocalProgress);
    
    if (result.error) {
      return {
        text: '',
        error: result.error
      };
    }
    
    return {
      text: result.text,
      language: 'english' // whisper-tiny.en is English only
    };
  } catch (error) {
    console.error('Local transcription error:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown local transcription error'
    };
  }
}

/**
 * Simulate transcription when no API key is provided
 * This is useful for testing the UI without consuming API credits
 */
async function simulateTranscription(file: File): Promise<TranscriptionResult> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    text: `This is a simulated transcription for file: ${file.name}\n\nSince no OpenAI API key was provided, we're generating mock content instead of actually transcribing the audio.\n\nIn a real scenario, the audio would be sent to OpenAI's Whisper model and the actual transcription would be returned.\n\nTo use real transcription, please provide an OpenAI API key in the settings.\n\nThis simulated transcript is being provided so you can test the interface and functionality without consuming API credits.`,
    language: 'english',
    duration: 120,
  };
}
