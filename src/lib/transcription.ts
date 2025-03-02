import OpenAI from 'openai';

// Create a type for the transcription result
export type TranscriptionResult = {
  text: string;
  language?: string;
  duration?: number;
  error?: string;
};

/**
 * Transcribe an audio file using OpenAI's Whisper model
 */
export async function transcribeAudio(
  file: File,
  apiKey?: string
): Promise<TranscriptionResult> {
  if (!apiKey) {
    return simulateTranscription(file);
  }

  try {
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');

    const response = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });

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
