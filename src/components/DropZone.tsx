'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onFileAccepted: (file: File) => void;
  isProcessing?: boolean;
  isConverting?: boolean;
  acceptedFileTypes?: string[];
  maxSize?: number;
}

export default function DropZone({
  onFileAccepted,
  isProcessing = false,
  isConverting = false,
  acceptedFileTypes = ['audio/*', 'video/*'],
  maxSize, // No default - allow undefined to disable size limits
}: DropZoneProps) {
  const [error, setError] = useState<string | null>(null);
  
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setError(null);
        onFileAccepted(acceptedFiles[0]);
      }
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, curr) => {
      acc[curr] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    disabled: isProcessing,
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      if (rejection) {
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError(`File is too large. Max size is ${maxSize ? `${maxSize / 1024 / 1024}MB` : 'unlimited'}`);
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError(`Invalid file type. Accepted types: ${acceptedFileTypes.join(', ')}`);
        } else {
          setError(rejection.errors[0]?.message || 'File was rejected');
        }
      }
    },
  });

  const getDropzoneClassName = () => {
    if (error) return 'dropzone dropzone-error';
    if (isDragReject) return 'dropzone dropzone-error';
    if (isDragActive) return 'dropzone dropzone-active';
    if (isProcessing || isConverting) return 'dropzone dropzone-success';
    return 'dropzone dropzone-idle';
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        getDropzoneClassName(),
        'h-48 w-full',
        (isProcessing || isConverting) && 'pointer-events-none opacity-70'
      )}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center justify-center space-y-2">
        {isDragActive ? (
          <div className="text-xl font-medium">Drop the media file here...</div>
        ) : isConverting ? (
          <>
            <div className="animate-pulse-slow">
              <svg
                className="w-12 h-12 text-warning"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <p className="text-warning font-medium">Converting video to audio...</p>
          </>
        ) : isProcessing ? (
          <>
            <div className="animate-pulse-slow">
              <svg
                className="w-12 h-12 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <p className="text-success font-medium">Processing audio...</p>
          </>
        ) : (
          <>
            <svg
              className="w-12 h-12 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            <p className="text-base">
              Drag & drop an audio or video file here, or <span className="text-primary">browse</span>
            </p>
            <p className="text-xs text-muted">
              Supported formats: MP3, WAV, M4A, FLAC, MP4, WebM, etc.
            </p>
          </>
        )}
      </div>
      
      {error && <p className="mt-2 text-error text-sm">{error}</p>}
    </div>
  );
}
