'use client';

import React, { useState } from 'react';
import { createWebVTT, downloadFile } from '@/lib/utils';

interface TranscriptDisplayProps {
  transcript: string;
  isLoading?: boolean;
}

export default function TranscriptDisplay({
  transcript,
  isLoading = false,
}: TranscriptDisplayProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  const handleExportJSON = () => {
    const json = JSON.stringify({ transcript }, null, 2);
    downloadFile(json, 'transcript.json', 'application/json');
  };

  const handleExportVTT = () => {
    const vtt = createWebVTT(transcript);
    downloadFile(vtt, 'transcript.vtt', 'text/vtt');
  };

  if (isLoading) {
    return (
      <div className="mt-6 p-4 bg-card rounded-lg border border-border animate-pulse">
        <div className="h-4 bg-muted/20 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-muted/20 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-muted/20 rounded w-5/6 mb-2"></div>
        <div className="h-4 bg-muted/20 rounded w-2/3"></div>
      </div>
    );
  }

  if (!transcript) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">Transcript</h2>
        <div className="flex space-x-2">
          <button 
            onClick={handleCopy}
            className="btn btn-outline text-sm"
            disabled={!transcript}
          >
            {copyStatus === 'copied' ? (
              <span className="flex items-center">
                <svg 
                  className="w-4 h-4 mr-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
                Copied
              </span>
            ) : (
              <span className="flex items-center">
                <svg 
                  className="w-4 h-4 mr-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" 
                  />
                </svg>
                Copy All
              </span>
            )}
          </button>
          
          <button 
            onClick={handleExportJSON}
            className="btn btn-outline text-sm"
            disabled={!transcript}
          >
            <span className="flex items-center">
              <svg 
                className="w-4 h-4 mr-1" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                />
              </svg>
              JSON
            </span>
          </button>
          
          <button 
            onClick={handleExportVTT}
            className="btn btn-outline text-sm"
            disabled={!transcript}
          >
            <span className="flex items-center">
              <svg 
                className="w-4 h-4 mr-1" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                />
              </svg>
              WebVTT
            </span>
          </button>
        </div>
      </div>
      
      <div className="p-4 bg-card rounded-lg border border-border">
        <pre className="whitespace-pre-wrap text-sm">{transcript}</pre>
      </div>
    </div>
  );
}
