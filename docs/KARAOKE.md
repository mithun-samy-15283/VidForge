# Karaoke Maker — Implementation Guide

## Overview
The karaoke pipeline transforms any music video into a karaoke version with:
- Vocals removed (instrumental only)
- Lyrics displayed and synced to the music
- Word-by-word highlighting (advanced ASS karaoke effects)

## Pipeline Code Walkthrough

### 1. Vocal Separation (Demucs)
We use Facebook Research's Demucs in two-stem mode (`vocals` vs `no_vocals`).
This produces studio-quality separation in ~real-time on a GPU and ~10x slower on CPU.

```bash
python -m demucs --two-stems=vocals -o output/ song.wav
```

### 2. Forced Alignment (Whisper)
Whisper with `word_timestamps=True` gives us precise (start, end) for each word.
This is critical for karaoke-style highlighting.

### 3. ASS Subtitle Generation
ASS (Advanced SubStation Alpha) supports karaoke tags like `{\k<duration>}`
which highlight words progressively. Example:

```
{\k20}I {\k30}walked {\k25}alone {\k40}tonight
```

Each `\k<N>` means "highlight this word over N centiseconds".

### 4. Final Render
```bash
ffmpeg -i video.mp4 -i instrumental.wav \
  -vf "ass=lyrics.ass" \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -c:a aac \
  karaoke.mp4
```

## Performance Tips
- **Cache Whisper model** (already done with `@lru_cache`)
- **Use GPU** for Demucs: 10-100x speedup
- **Choose smaller Whisper model** ("tiny" or "base") for speed
- **Pre-extract audio** to avoid re-decoding video

## Future Enhancements
- [ ] Animated backgrounds (Lottie / particle effects)
- [ ] Pitch shifting (key changes for vocalists)
- [ ] Multi-language lyrics translation
- [ ] User-editable lyrics timeline
- [ ] Score / tempo detection for visual sync

## Quality Checklist
- [ ] Test with: pop, rap, rock, instrumental
- [ ] Handle non-vocal sections gracefully
- [ ] Validate sub timing on slow & fast songs
- [ ] Ensure non-Latin scripts render correctly
