# Claude Code Project Rules

## YouTube Transcription Auto-Processing

### Trigger Rule: YouTube Links

When a user provides a YouTube URL (matching patterns: `youtube.com/watch`, `youtu.be/`, `youtube.com/embed/`), Claude should automatically:

1. **Download the audio** using yt-dlp:

   ```bash
   yt-dlp --extract-audio --audio-format mp3 --output "downloads/%(title)s.%(ext)s" "<YOUTUBE_URL>"
   ```

2. **Run the transcription tool**:

   ```bash
   npm run transcribe "<YOUTUBE_URL>"
   ```

   Or directly:

   ```bash
   node cli/youtube-transcriber.js "<YOUTUBE_URL>"
   ```

3. **Create organized output** in the following structure:

   ```
   results/
   └── {sanitized_video_title}/
       ├── downloads/
       │   └── video_title.mp3    (audio file)
       └── transcripts/
           ├── transcript.txt     (plain text)
           ├── transcript.json    (JSON with metadata)
           ├── transcript.srt     (subtitle format)
           └── transcript.vtt     (WebVTT format)
   ```

### Requirements

- Ensure `OPENAI_API_KEY` or `OPENAI_KEY` is set (checks `.env` file automatically)
- Dependencies: `yt-dlp`, `ffmpeg` (if needed), `openai` npm package
- Files are saved in dedicated folders named after the video title (sanitized)

### Example Usage

When user provides:

```
https://www.youtube.com/watch?v=Tvs3wEt2H8I
```

Claude should respond with:

1. Acknowledgment of YouTube URL detected
2. Automatic execution of the transcription process
3. Summary of generated files and their locations

### Error Handling

- If `OPENAI_API_KEY` is missing, prompt for it
- If yt-dlp fails, provide troubleshooting steps
- If file is >25MB, suggest chunking or compression

## Project Structure

```
transcriber/
├── cli/
│   ├── youtube-transcriber.js    # Main CLI tool
│   ├── transcribe-chunked.js     # For large files  
│   └── README.md                 # CLI documentation
├── results/                      # Organized outputs per video
│   └── {video_title}/           # Per-video buckets
│       ├── downloads/           # Video-specific audio files
│       ├── transcripts/         # Video-specific transcripts
│       └── temp_chunks/         # Temporary processing files
├── src/                         # Web app source
├── tests/                       # Test files
└── CLAUDE.md                    # This file
```

## Testing

Run tests with:

```bash
npm test
```

Tests should validate:

- YouTube URL parsing
- Audio download functionality
- Transcription accuracy
- File output formats
- Folder structure creation

## CLI Tool Documentation

See `cli/README.md` for detailed CLI usage instructions.
