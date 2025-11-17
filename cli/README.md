# YouTube Transcriber CLI

A command-line tool to download audio from YouTube videos and transcribe them using OpenAI's Whisper API.

## Features

- Download audio from YouTube videos using `yt-dlp`
- Transcribe audio using OpenAI's Whisper model
- Generate multiple output formats (TXT, JSON, SRT, VTT)
- Organized file structure with dedicated folders per video
- Support for videos up to 25MB (audio file size)
- Interactive API key prompt if not set in environment

## Prerequisites

### System Dependencies

- [Node.js](https://nodejs.org/) (v16 or higher)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube downloader
- [ffmpeg](https://ffmpeg.org/) - Audio/video processing (usually installed with yt-dlp)

### Install yt-dlp

```bash
# macOS (with Homebrew)
brew install yt-dlp

# Linux (Ubuntu/Debian)
sudo apt install yt-dlp

# Or via pip
pip install yt-dlp
```

### OpenAI API Key

You need an OpenAI API key to use the transcription service.

Set it as an environment variable:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

Or add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
echo 'export OPENAI_API_KEY="your-api-key-here"' >> ~/.zshrc
```

## Installation

1. Clone or navigate to the transcriber project
2. Install Node.js dependencies:

   ```bash
   npm install
   ```

## Usage

### Basic Usage

```bash
# Using npm script
npm run transcribe "https://www.youtube.com/watch?v=VIDEO_ID"

# Or directly with Node
node cli/youtube-transcriber.js "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Supported URL Formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`  
- `https://www.youtube.com/embed/VIDEO_ID`

### Example

```bash
npm run transcribe "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

This will:

1. Download audio as MP3 to video-specific folder in `results/`
2. Transcribe using OpenAI Whisper
3. Create organized folders bucketed by sanitized video title
4. Generate multiple transcript formats

## Output Structure

```
transcriber/
├── results/
│   └── sanitized_video_title/    # Organized per video
│       ├── downloads/
│       │   └── video_title.mp3   # Video-specific audio file
│       └── transcripts/
│           ├── transcript.txt    # Plain text transcript
│           ├── transcript.json   # JSON with metadata + segments
│           ├── transcript.srt    # SubRip subtitle format
│           └── transcript.vtt    # WebVTT subtitle format
└── cli/                         # CLI tools
    ├── youtube-transcriber.js   # Main CLI tool
    ├── transcribe-chunked.js    # For large files
    └── README.md               # This documentation
```

## Output Formats

### 1. Plain Text (`.txt`)

Simple text transcription, perfect for reading or further processing.

### 2. JSON (`.json`)

Complete data including:

- Video metadata (title, duration, URL, timestamp)
- Full transcription
- Individual segments with timestamps
- Language detection

### 3. SubRip (`.srt`)

Standard subtitle format compatible with most video players:

```
1
00:00:00,000 --> 00:00:05,000
First segment of transcribed audio

2
00:00:05,000 --> 00:00:10,000
Second segment of transcribed audio
```

### 4. WebVTT (`.vtt`)

Web Video Text Tracks format for HTML5 video:

```
WEBVTT

00:00:00.000 --> 00:00:05.000
First segment of transcribed audio

00:00:05.000 --> 00:00:10.000
Second segment of transcribed audio
```

## Error Handling

### Common Issues

**"OpenAI API key not found"**

- Set the `OPENAI_API_KEY` environment variable
- The tool will prompt for the key if not found

**"Invalid YouTube URL"**

- Ensure the URL is a valid YouTube video link
- Check that the video is publicly accessible

**"Audio file is too large (>25MB)"**

- Current OpenAI Whisper limit is 25MB per request
- Consider shorter videos or audio compression

**"Failed to download audio"**

- Check that `yt-dlp` is installed and accessible
- Verify the YouTube URL is correct and accessible
- Some videos may be region-restricted or private

### Troubleshooting

1. **Verify dependencies:**

   ```bash
   yt-dlp --version
   node --version
   ```

2. **Test yt-dlp separately:**

   ```bash
   yt-dlp --extract-audio --audio-format mp3 "YOUR_URL"
   ```

3. **Check API key:**

   ```bash
   echo $OPENAI_API_KEY
   ```

## Limitations

- Audio files must be under 25MB (OpenAI Whisper API limit)
- Requires internet connection for both download and transcription
- Transcription accuracy depends on audio quality
- Some YouTube videos may be restricted or unavailable

## Integration with Claude Code

This tool is designed to work automatically with Claude Code through the `CLAUDE.md` rules. When you paste a YouTube URL in Claude Code, it should automatically trigger the transcription process.

## Development

### Running Tests

```bash
npm test
```

### Code Structure

- `youtube-transcriber.js` - Main CLI tool class
- Error handling and validation
- Support for multiple output formats
- Interactive prompts for missing configuration

## TikTok Profile URL Collector

Use the Playwright-backed helper to gather direct video links from a TikTok profile for later processing with `yt-dlp`.

```bash
# Default: launches Chromium in headed mode and writes to results/tiktok/<username>/urls.txt
node cli/tiktok-collect-urls.js mike.assayag

# Custom output path, append mode, and headless browser
node cli/tiktok-collect-urls.js https://www.tiktok.com/@mike.assayag \
  --output results/mike_assayag_tiktok/urls.txt \
  --append --headless --max 250
```

### Notable flags

- `--output <path>`: Where to write the newline-separated URL list (directories created automatically).
- `--append`: Append instead of overwriting.
- `--max <count>`: Stop once at least `<count>` unique videos are collected.
- `--browser <chromium|firefox|webkit>`: Choose the Playwright browser (defaults to Chromium).
- `--headless`: Run without a visible window; omit when you need to authenticate.
- `--user-data-dir <path>`: Reuse an existing browser profile to leverage stored TikTok cookies.
- `--delay <ms>`: Milliseconds to wait between scrolls (default 1200ms).
- `--auto-login`: Attempt to authenticate automatically using `TIKTOK_USERNAME` and `TIKTOK_PASSWORD` from `.env` (falls back to `tiktok_username`/`tiktok_password`).

Set credentials in a `.env` file at the project root:

```
TIKTOK_USERNAME=your-email@example.com
TIKTOK_PASSWORD=super-secure-password
```

The script loads `.env` automatically; environment variables already present will take precedence.

### Contributing

Feel free to submit issues or pull requests to improve the tool.
