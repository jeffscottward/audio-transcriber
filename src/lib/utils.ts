import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  
  if (hrs > 0) {
    parts.push(hrs.toString().padStart(2, '0'));
  }
  
  parts.push(mins.toString().padStart(2, '0'));
  parts.push(secs.toString().padStart(2, '0'));
  
  return parts.join(':');
}

export function createWebVTT(transcript: string): string {
  if (!transcript) return '';
  
  const lines = transcript.split('\n').filter(line => line.trim() !== '');
  let webvtt = 'WEBVTT\n\n';
  
  lines.forEach((line, index) => {
    const startTime = index * 5; // Assume each line takes about 5 seconds
    const endTime = startTime + 5;
    
    webvtt += `${index + 1}\n`;
    webvtt += `${formatTime(startTime)}.000 --> ${formatTime(endTime)}.000\n`;
    webvtt += `${line}\n\n`;
  });
  
  return webvtt;
}

export function downloadFile(content: string, filename: string, contentType: string) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
