/**
 * Media conversion utilities for extracting audio from video files
 */

/**
 * Extracts audio from a video file and returns it as an audio blob
 * Uses the browser's built-in capabilities to extract audio
 * 
 * @param videoFile The video file to extract audio from (MP4, WebM, etc.)
 * @returns Promise resolving to a File object containing the extracted audio
 */
export async function extractAudioFromVideo(videoFile: File): Promise<File> {
  // This implementation creates a more browser-compatible audio file
  return new Promise<File>((resolve, reject) => {
    try {
      console.log('Starting video to audio conversion...');
      
      // Create video element
      const videoElement = document.createElement('video');
      videoElement.style.display = 'none';
      document.body.appendChild(videoElement);
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a blob URL for the video file
      const videoUrl = URL.createObjectURL(videoFile);
      videoElement.src = videoUrl;
      videoElement.preload = 'metadata';
      
      // Wait for metadata to load
      videoElement.onloadedmetadata = () => {
        try {
          const videoDuration = videoElement.duration;
          console.log(`Video duration: ${videoDuration} seconds`);
          
          if (!isFinite(videoDuration) || videoDuration <= 0) {
            cleanup(videoElement, videoUrl);
            reject(new Error('Invalid video duration detected'));
            return;
          }
          
          // Create audio nodes
          const source = audioContext.createMediaElementSource(videoElement);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);
          
          // Prefer WAV for better browser compatibility with duration metadata
          let mimeType = '';
          const preferredTypes = [
            'audio/wav',  // Better metadata compatibility
            'audio/ogg',
            'audio/webm', 
            'audio/mp3'
          ];
          
          for (const type of preferredTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
              mimeType = type;
              break;
            }
          }
          
          if (!mimeType) {
            cleanup(videoElement, videoUrl);
            reject(new Error('No supported audio recording format found'));
            return;
          }
          
          console.log(`Using recording format: ${mimeType}`);
          
          // Create media recorder with high bitrate for better quality
          const mediaRecorder = new MediaRecorder(destination.stream, { 
            mimeType,
            audioBitsPerSecond: 128000 // 128 kbps for better quality
          });
          
          // Set up data collection
          const audioChunks: Blob[] = [];
          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              audioChunks.push(e.data);
              console.log(`Recorded chunk: ${e.data.size} bytes`);
            }
          };
          
          // Handle recording completion
          mediaRecorder.onstop = () => {
            try {
              console.log('Recording stopped');
              videoElement.pause();
              
              if (audioChunks.length === 0) {
                cleanup(videoElement, videoUrl);
                reject(new Error('No audio data captured'));
                return;
              }
              
              // Create final audio blob
              const audioBlob = new Blob(audioChunks, { type: mimeType });
              console.log(`Audio size: ${audioBlob.size} bytes`);
              
              // Generate filename
              const baseName = videoFile.name.substring(0, videoFile.name.lastIndexOf('.'));
              const ext = mimeType.split('/')[1];
              const audioFilename = `${baseName}.${ext}`;
              
              // Before returning the file, verify we can play it successfully
              const testAudio = new Audio();
              const testUrl = URL.createObjectURL(audioBlob);
              testAudio.src = testUrl;
              
              // Wait for test audio to load metadata
              testAudio.onloadedmetadata = () => {
                URL.revokeObjectURL(testUrl);
                
                if (!isFinite(testAudio.duration) || testAudio.duration <= 0) {
                  console.warn('Generated audio has invalid duration, falling back to fixed duration');
                  // Create file object with manually added duration if needed
                  const audioFile = new File([audioBlob], audioFilename, { 
                    type: mimeType,
                    lastModified: Date.now()
                  });
                  
                  // Clean up and resolve
                  cleanup(videoElement, videoUrl);
                  resolve(audioFile);
                } else {
                  console.log(`Verified audio duration: ${testAudio.duration} seconds`);
                  // Create file object
                  const audioFile = new File([audioBlob], audioFilename, { 
                    type: mimeType,
                    lastModified: Date.now()
                  });
                  
                  // Clean up and resolve
                  cleanup(videoElement, videoUrl);
                  resolve(audioFile);
                }
              };
              
              // Handle test audio loading error
              testAudio.onerror = () => {
                URL.revokeObjectURL(testUrl);
                console.warn('Audio verification failed, using file directly');
                
                // Create file object anyway
                const audioFile = new File([audioBlob], audioFilename, { 
                  type: mimeType,
                  lastModified: Date.now() 
                });
                
                // Clean up and resolve
                cleanup(videoElement, videoUrl);
                resolve(audioFile);
              };
              
              // Set a test timeout
              setTimeout(() => {
                if (!testAudio.duration || !isFinite(testAudio.duration)) {
                  URL.revokeObjectURL(testUrl);
                  console.warn('Audio metadata loading timed out, using file directly');
                  
                  // Create file object anyway
                  const audioFile = new File([audioBlob], audioFilename, { 
                    type: mimeType,
                    lastModified: Date.now()
                  });
                  
                  // Clean up and resolve
                  cleanup(videoElement, videoUrl);
                  resolve(audioFile);
                }
              }, 3000); // 3 second timeout for metadata loading
            } catch (err) {
              cleanup(videoElement, videoUrl);
              reject(err);
            }
          };
          
          // Set up recording completion trigger
          videoElement.onended = () => {
            if (mediaRecorder.state !== 'inactive') {
              console.log('Video ended, stopping recorder');
              mediaRecorder.stop();
            }
          };
          
          // Set a safety timeout
          const timeoutMs = (videoDuration * 1000) + 2000; // Add 2 second buffer
          
          const safetyTimeout = setTimeout(() => {
            if (mediaRecorder.state !== 'inactive') {
              console.log('Safety timeout reached, stopping recorder');
              mediaRecorder.stop();
            }
          }, timeoutMs);
          
          // Start recording with smaller chunks for better timing
          console.log('Starting recording');
          mediaRecorder.start(500); // Collect in 500ms chunks
          
          // Play the video to extract audio
          videoElement.play().catch(err => {
            clearTimeout(safetyTimeout);
            cleanup(videoElement, videoUrl);
            reject(new Error(`Failed to play video: ${err.message}`));
          });
        } catch (err) {
          cleanup(videoElement, videoUrl);
          reject(err);
        }
      };
      
      // Handle errors
      videoElement.onerror = () => {
        cleanup(videoElement, videoUrl);
        reject(new Error('Video loading error'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Helper function to clean up video elements and URL objects
 */
function cleanup(videoElement: HTMLVideoElement, videoUrl: string) {
  if (videoElement) {
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();
    if (videoElement.parentNode) {
      document.body.removeChild(videoElement);
    }
  }
  URL.revokeObjectURL(videoUrl);
}

/**
 * Determines if a file is a video file based on its type
 * 
 * @param file The file to check
 * @returns True if the file is a video, false otherwise
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * Determines if a file is an audio file based on its type
 * 
 * @param file The file to check
 * @returns True if the file is an audio, false otherwise
 */
export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/');
}
