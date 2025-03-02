'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  file: File | null;
  className?: string;
}

export default function AudioPlayer({ file, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Create object URL for the audio file
  useEffect(() => {
    if (file) {
      try {
        console.log(`Loading audio file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
        const url = URL.createObjectURL(file);
        setAudioUrl(url);
        
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.error('Error creating object URL:', err);
        setAudioUrl(null);
      }
    } else {
      setAudioUrl(null);
    }
  }, [file]);
  
  // Update audio element when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.load();
      
      // Reset state when loading a new audio file
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    }
  }, [audioUrl]);
  
  // Handle audio events
  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };
  
  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      console.log(`Audio duration loaded: ${audioDuration} seconds`);
      
      if (isFinite(audioDuration) && audioDuration > 0) {
        setDuration(audioDuration);
      } else {
        console.warn('Invalid audio duration:', audioDuration);
        // Try to get an approximate duration from the file size
        // Assuming ~128kbps audio, approximate duration
        if (file) {
          const fileSizeInBits = file.size * 8;
          const bitRate = 128000; // Estimated bit rate (128kbps)
          const estimatedDuration = fileSizeInBits / bitRate;
          console.log(`Estimated duration from file size: ${estimatedDuration} seconds`);
          
          if (estimatedDuration > 0) {
            setDuration(estimatedDuration);
          } else {
            // Set a default value so the player is usable
            setDuration(60); // Assume 1 minute if we can't determine
          }
        } else {
          // Set a default value so the player is usable
          setDuration(60); // Assume 1 minute if we can't determine
        }
      }
      
      // Force a play attempt to verify audio works
      if (audioRef.current && !audioRef.current.duration) {
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
        }).catch(err => {
          console.warn('Initial play test failed:', err);
        });
      }
    }
  };
  
  const handleLoadError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const error = (e.target as HTMLAudioElement).error;
    console.error('Audio loading error:', error);
    
    // Try to reload with a different source format if possible
    if (file && audioRef.current) {
      console.log('Attempting to reload audio with different format...');
      
      // Force a small timeout before trying again
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.load();
        }
      }, 500);
    }
  };
  
  // Additional event handler for audio stall
  const handleStalled = () => {
    console.warn('Audio playback stalled');
    if (audioRef.current && isPlaying) {
      // Try to recover by reloading
      audioRef.current.load();
      audioRef.current.play().catch(err => {
        console.error('Failed to recover from stall:', err);
        setIsPlaying(false);
      });
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!file || !audioUrl) return null;
  
  return (
    <div className={cn("p-4 bg-card rounded-lg border border-border mt-2", className)}>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleLoadError}
        onStalled={handleStalled}
        onSuspend={() => console.log('Audio suspended')}
        onWaiting={() => console.log('Audio waiting for data')}
        preload="metadata"
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      >
        {/* Try the original file type first */}
        <source src={audioUrl} type={file.type} />
        {/* Fallbacks for various audio formats */}
        <source src={audioUrl} type="audio/wav" />
        <source src={audioUrl} type="audio/webm" />
        <source src={audioUrl} type="audio/ogg" />
        <source src={audioUrl} type="audio/mp3" />
        <source src={audioUrl} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-shrink-0">
          {isPlaying ? (
            <button
              onClick={handlePause}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-primary hover:bg-primary-hover text-background transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6M9 9h1m4 0h1m-5 6h.01M9 9h.01" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-primary hover:bg-primary-hover text-background transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
        
        <div className="flex-1 w-full">
          <div className="flex justify-between text-xs mb-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(currentTime / (duration || 1)) * 100}%, var(--border) ${(currentTime / (duration || 1)) * 100}%, var(--border) 100%)`
            }}
          />
        </div>
      </div>
    </div>
  );
}
