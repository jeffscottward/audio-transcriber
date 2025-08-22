'use client';

import React, { useState } from 'react';
import DropZone from '@/components/DropZone';
import ApiKeyInput from '@/components/ApiKeyInput';
import TranscriptDisplay from '@/components/TranscriptDisplay';
import AudioPlayer from '@/components/AudioPlayer';
import { transcribeAudio, type TranscriptionResult } from '@/lib/transcription';
import { transcribeAudioInChunks, generateTranscriptFile, type ChunkedTranscriptionProgress, type ChunkedTranscriptionResult, type TranscriptFormat } from '@/lib/chunkedTranscription';
import { isVideoFile, isAudioFile, extractAudioFromVideo } from '@/lib/mediaConverter';

export default function Home() {
  const [apiKey, setApiKey] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [isChunkedProcessing, setIsChunkedProcessing] = useState(false);
  const [chunkProgress, setChunkProgress] = useState<ChunkedTranscriptionProgress | null>(null);
  const [chunkedResult, setChunkedResult] = useState<ChunkedTranscriptionResult | null>(null);
  
  const handleFileAccepted = async (acceptedFile: File) => {
    setOriginalFileName(acceptedFile.name);
    setError(null);
    setTranscript('');
    setChunkedResult(null);
    setChunkProgress(null);
    
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
    
    // Check if file is large enough to require chunking (>25MB or user preference)
    const shouldChunk = fileToProcess.size > 25 * 1024 * 1024; // 25MB threshold
    
    if (shouldChunk && apiKey) {
      // Use chunked processing for large files
      setIsChunkedProcessing(true);
      
      try {
        const result = await transcribeAudioInChunks(
          fileToProcess,
          apiKey,
          (progress) => {
            setChunkProgress(progress);
          },
          {
            chunkDurationSeconds: 120, // 2 minute chunks to be safer
            overlapSeconds: 5,
            maxChunkSize: 20 * 1024 * 1024 // 20MB max per chunk (will be further reduced in chunker)
          },
          {
            mode: apiKey ? 'openai' : 'local',
            onLocalProgress: (progress) => {
              setChunkProgress(prev => ({
                ...prev!,
                modelLoading: progress.status === 'loading',
                modelLoadProgress: progress.progress
              }));
            }
          }
        );
        
        setChunkedResult(result);
        if (result.error) {
          setError(result.error);
        } else {
          setTranscript(result.fullText);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred during chunked processing');
      } finally {
        setIsChunkedProcessing(false);
      }
    } else {
      // Use regular processing for smaller files
      setIsProcessing(true);
      
      try {
        const result: TranscriptionResult = await transcribeAudio(
          fileToProcess, 
          apiKey,
          {
            mode: apiKey ? 'openai' : 'local',
            onLocalProgress: (progress) => {
              // Could add progress for single files too
              console.log('Local transcription progress:', progress);
            }
          }
        );
        
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
    }
  };
  
  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
  };

  const handleDownloadTranscript = (format: TranscriptFormat = 'txt') => {
    if (!chunkedResult) return;
    
    const { blob, filename } = generateTranscriptFile(chunkedResult, originalFileName, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          isProcessing={isProcessing || isChunkedProcessing}
          isConverting={isConverting}
          maxSize={undefined} // Remove size limit for chunked processing
        />
        
        {/* Chunk processing progress */}
        {isChunkedProcessing && chunkProgress && (
          <div className="p-4 bg-primary/10 border border-primary rounded-lg">
            {chunkProgress.modelLoading && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Loading AI model...</span>
                  <span className="text-sm">{chunkProgress.modelLoadProgress || 0}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-warning h-2 rounded-full transition-all duration-300"
                    style={{ width: `${chunkProgress.modelLoadProgress || 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-1">
                  Downloading Whisper model (~39MB) - this only happens once
                </p>
              </div>
            )}
            
            {!chunkProgress.modelLoading && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">
                    {apiKey ? 'Processing with OpenAI...' : 'Processing locally...'}
                  </span>
                  <span className="text-sm">{chunkProgress.currentChunk}/{chunkProgress.totalChunks}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mb-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(chunkProgress.currentChunk / chunkProgress.totalChunks) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted">
                  Currently transcribing chunk {chunkProgress.currentChunk} of {chunkProgress.totalChunks}
                </p>
                
                {/* Real-time transcription display */}
                {chunkProgress.currentText && (
                  <div className="mt-3 p-2 bg-background/50 rounded border text-sm">
                    <p className="text-xs text-muted mb-1">Latest transcribed text:</p>
                    <p className="text-foreground">{chunkProgress.currentText}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {file && !isProcessing && !isChunkedProcessing && !isConverting && !error && (
          <>
            <div className="text-center text-sm text-muted">
              Processed file: <span className="text-foreground">{originalFileName || file.name}</span>
              {originalFileName !== file.name && isVideoFile(new File([], originalFileName, { type: 'video/mp4' })) && (
                <span className="ml-1 text-warning">(converted from video)</span>
              )}
              <span className="ml-1">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
              {file.size > 25 * 1024 * 1024 && (
                <span className="ml-1 text-primary">(processed in chunks)</span>
              )}
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
      
      {/* Download buttons for chunked results */}
      {chunkedResult && !isChunkedProcessing && transcript && (
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">Download Transcript</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => handleDownloadTranscript('txt')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                Download TXT
              </button>
              <button
                onClick={() => handleDownloadTranscript('srt')}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors text-sm"
              >
                Download SRT
              </button>
              <button
                onClick={() => handleDownloadTranscript('vtt')}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors text-sm"
              >
                Download VTT
              </button>
              <button
                onClick={() => handleDownloadTranscript('json')}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors text-sm"
              >
                Download JSON
              </button>
            </div>
          </div>
          <p className="text-xs text-muted">
            TXT: Full transcript with timestamps | SRT/VTT: Subtitle formats | JSON: Machine-readable data
          </p>
        </div>
      )}
      
      <TranscriptDisplay transcript={transcript} isLoading={isProcessing || isChunkedProcessing} />
    </div>
  );
}
