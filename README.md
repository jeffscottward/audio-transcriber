# Audio Transcriber

A Next.js application that transcribes audio files using OpenAI's Whisper model. The app features a modern, dark-themed UI with drag-and-drop functionality.

## Features

- 🎤 Audio transcription using OpenAI's Whisper model
- 🎬 Video-to-audio conversion for transcribing MP4 and other video files
- 🖱️ Drag-and-drop interface for easy file uploads
- 🎧 Built-in audio player with playback controls
- 📋 Copy transcript to clipboard with one click
- 💾 Export transcripts as WebVTT or JSON
- 🎨 Beautiful dark theme with pastel color accents
- 🔒 Local API key storage for privacy

## Getting Started

### Prerequisites

- Node.js 18.17.0 or later
- npm or yarn
- OpenAI API key (optional, for real transcription)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/audio-transcriber.git
cd audio-transcriber
```

1. Install dependencies:

```bash
npm install
# or
yarn install
```

1. Run the development server:

```bash
npm run dev
# or
yarn dev
```

1. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter your OpenAI API key in the settings section (optional)
2. Drag and drop an audio or video file into the dropzone, or click to select a file
   - Video files (MP4, WebM, etc.) will automatically be converted to audio before transcription
   - The conversion happens in your browser - no file upload to external servers needed
3. Wait for the conversion (if applicable) and transcription to process
4. View the transcript in the display area
5. Listen to the audio using the built-in player if desired
6. Use the buttons to copy or export the transcript as needed

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- OpenAI API (Whisper model)
- react-dropzone

## License

MIT
