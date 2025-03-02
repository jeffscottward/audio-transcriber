'use client';

import React, { useState } from 'react';
import DropZone from '@/components/DropZone';
import ApiKeyInput from '@/components/ApiKeyInput';
import TranscriptDisplay from '@/components/TranscriptDisplay';
import AudioPlayer from '@/components/AudioPlayer';
import { transcribeAudio, type TranscriptionResult } from '@/lib/transcription';
import { isVideoFile, isAudioFile, extractAudioFromVideo } from '@/lib/mediaConverter';

export default function Home() {
  const [apiKey, setApiKey] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  
  const handleFileAccepted = async (acceptedFile: File) => {
    setOriginalFileName(acceptedFile.name);
    setError(null);
    
    let fileToProcess = acceptedFile;
    
    // If it's a video file, we need to extract the audio first
    if (isVideoFile(acceptedFile)) {
      try {
        setIsConverting(true);
        console.log('Starting video to audio conversion...');
        fileToProcess = await extractAudioFromVideo(acceptedFile);
        console.log('Conversion complete:', fileToProcess.name, fileToProcess.type);
        setIsConverting(false);
      } catch (err) {
        console.error('Conversion error:', err);
        setIsConverting(false);
        
        // More descriptive error message
        let errorMessage = 'Failed to extract audio from video';
        if (err instanceof Error) {
          if (err.message.includes('Failed to construct \'MediaRecorder\'')) {
            errorMessage = 'Your browser doesn\'t support the required audio recording features. Please try a different browser like Chrome or Firefox.';
          } else {
            errorMessage = `${errorMessage}: ${err.message}`;
          }
        } else {
          errorMessage = `${errorMessage}: Unknown error`;
        }
        
        setError(errorMessage);
        return;
      }
    } else if (!isAudioFile(acceptedFile)) {
      setError('Unsupported file type. Please upload an audio or video file.');
      return;
    }
    
    // Continue with transcription process
    setFile(fileToProcess);
    setIsProcessing(true);
    
    try {
      const result: TranscriptionResult = await transcribeAudio(fileToProcess, apiKey);
      
      if (result.error) {
        setError(result.error);
        setTranscript('');
      } else {
        setTranscript(result.text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setTranscript('');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
  };
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">Audio Transcriber</h1>
        <p className="text-muted">
          Drag and drop your audio files for quick, accurate transcription
        </p>
      </div>
      
      <ApiKeyInput onApiKeyChange={handleApiKeyChange} />
      
      <div className="space-y-4">
        <DropZone 
          onFileAccepted={handleFileAccepted} 
          isProcessing={isProcessing}
          isConverting={isConverting}
        />
        
        {file && !isProcessing && !isConverting && !error && (
          <>
            <div className="text-center text-sm text-muted">
              Processed file: <span className="text-foreground">{originalFileName || file.name}</span>
              {originalFileName !== file.name && isVideoFile(new File([], originalFileName, { type: 'video/mp4' })) && (
                <span className="ml-1 text-warning">(converted from video)</span>
              )}
              <span className="ml-1">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
            </div>
            
            <AudioPlayer file={file} />
          </>
        )}
        
        {error && (
          <div className="p-4 bg-error/10 border border-error text-error rounded-lg">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
      
      <TranscriptDisplay transcript={transcript} isLoading={isProcessing} />
    </div>
  );
}
