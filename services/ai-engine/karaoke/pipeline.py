"""
Karaoke generation pipeline.

Stages:
  1. Extract audio from input video (FFmpeg)
  2. Separate vocals from instrumental (Demucs or FFmpeg fallback)
  3. Transcribe lyrics with word-level timestamps (Whisper or mock)
  4. Generate ASS subtitle file with karaoke timing
  5. Mux instrumental audio + original video + ASS subtitles -> output mp4

Modes:
  MOCK_AI=true   → Fast demo path: no ML models needed, mock lyrics, copies audio
  MOCK_AI=false  → Attempts real Demucs + Whisper; falls back to FFmpeg vocal
                   removal if Demucs is unavailable
"""

import os
import json
import shutil
import struct
import subprocess
import tempfile
import logging
import wave
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

MOCK_AI = os.getenv("MOCK_AI", "false").lower() in ("1", "true", "yes")


def _check_demucs() -> bool:
    """Check if Demucs is importable."""
    try:
        import demucs  # noqa: F401
        return True
    except ImportError:
        return False


def _check_whisper() -> bool:
    """Check if openai-whisper is importable."""
    try:
        import whisper  # noqa: F401
        return True
    except ImportError:
        return False


HAS_DEMUCS = _check_demucs()
HAS_WHISPER = _check_whisper()

logger.info(
    "Pipeline init — MOCK_AI=%s  HAS_DEMUCS=%s  HAS_WHISPER=%s",
    MOCK_AI, HAS_DEMUCS, HAS_WHISPER,
)


# ---------------------------------------------------------------------------
# Stage 1: extract audio
# ---------------------------------------------------------------------------
def extract_audio(video_path: str, out_wav: str) -> str:
    """Extract audio from video as 44.1 kHz stereo WAV."""
    cmd = [
        "ffmpeg", "-y", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2",
        out_wav,
    ]
    logger.info("FFmpeg extract_audio: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg extract_audio failed: {result.stderr[:500]}")
    if not os.path.exists(out_wav) or os.path.getsize(out_wav) == 0:
        raise RuntimeError("FFmpeg produced no audio output")
    logger.info("Audio extracted: %s (%d bytes)", out_wav, os.path.getsize(out_wav))
    return out_wav


# ---------------------------------------------------------------------------
# Stage 2: vocal separation
# ---------------------------------------------------------------------------
def separate_vocals(audio_path: str, out_dir: str) -> Dict[str, str]:
    """
    Separate vocals and instrumental from audio.

    Strategy:
      1. If MOCK_AI → just copy source audio as both tracks (fast demo)
      2. If Demucs available → use Demucs (best quality)
      3. Else → FFmpeg-based center-channel removal (decent quality, no ML)

    Returns: {'vocals': path, 'instrumental': path}
    """
    os.makedirs(out_dir, exist_ok=True)
    instrumental = os.path.join(out_dir, "instrumental.wav")
    vocals = os.path.join(out_dir, "vocals.wav")

    if MOCK_AI:
        logger.info("[MOCK] Skipping vocal separation; copying source audio")
        shutil.copy(audio_path, instrumental)
        shutil.copy(audio_path, vocals)
        return {"vocals": vocals, "instrumental": instrumental}

    if HAS_DEMUCS:
        return _separate_with_demucs(audio_path, out_dir, vocals, instrumental)

    logger.info("Demucs not available — using FFmpeg-based vocal removal")
    return _separate_with_ffmpeg(audio_path, out_dir, vocals, instrumental)


def _separate_with_demucs(
    audio_path: str, out_dir: str, vocals_out: str, instrumental_out: str
) -> Dict[str, str]:
    """Use Demucs (Facebook Research) for studio-quality stem separation."""
    cmd = [
        "python3", "-m", "demucs",
        "--two-stems=vocals",
        "-o", out_dir,
        audio_path,
    ]
    logger.info("Demucs: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.warning("Demucs failed, falling back to FFmpeg: %s", result.stderr[:300])
        return _separate_with_ffmpeg(audio_path, out_dir, vocals_out, instrumental_out)

    # Demucs writes to <out_dir>/htdemucs/<basename>/{vocals.wav, no_vocals.wav}
    base = Path(audio_path).stem
    demucs_out = Path(out_dir) / "htdemucs" / base
    if (demucs_out / "vocals.wav").exists():
        shutil.move(str(demucs_out / "vocals.wav"), vocals_out)
        shutil.move(str(demucs_out / "no_vocals.wav"), instrumental_out)
    else:
        logger.warning("Demucs output not found at %s, falling back to FFmpeg", demucs_out)
        return _separate_with_ffmpeg(audio_path, out_dir, vocals_out, instrumental_out)

    return {"vocals": vocals_out, "instrumental": instrumental_out}


def _separate_with_ffmpeg(
    audio_path: str, out_dir: str, vocals_out: str, instrumental_out: str
) -> Dict[str, str]:
    """
    FFmpeg-based vocal removal using center-channel extraction.

    Technique: In most stereo music mixes, vocals are panned center (equal in L+R).
    By computing the stereo difference (L-R) we cancel center content (vocals).

    For the instrumental we:
      1. Compute side-channel stereo difference (removes center-panned vocals)
      2. Blend back ~30% of the original to preserve bass and fullness
      3. Apply a low-shelf boost to recover lost low-end

    For vocals we:
      1. Average L+R channels (center extraction)
      2. Apply bandpass filter to focus on vocal frequency range (200Hz-8kHz)
    """
    # --- Instrumental: stereo difference (removes center-panned vocals) ---
    # pan formula: L-R and R-L removes center (vocals).
    # Then add a lowshelf boost to recover bass and highpass to remove rumble.
    cmd_instrumental = [
        "ffmpeg", "-y", "-i", audio_path,
        "-af",
        "pan=stereo|c0=c0-c1|c1=c1-c0,"
        "lowshelf=gain=6:frequency=200,"
        "highpass=f=35",
        "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2",
        instrumental_out,
    ]
    logger.info("FFmpeg instrumental: %s", " ".join(cmd_instrumental))
    result = subprocess.run(cmd_instrumental, capture_output=True, text=True)
    if result.returncode != 0:
        logger.warning("FFmpeg instrumental extraction failed, trying minimal fallback: %s", result.stderr[:300])
        # Minimal fallback: just pan formula without extra filters
        cmd_simple = [
            "ffmpeg", "-y", "-i", audio_path,
            "-af",
            "pan=stereo|c0=c0-c1|c1=c1-c0",
            "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2",
            instrumental_out,
        ]
        result2 = subprocess.run(cmd_simple, capture_output=True, text=True)
        if result2.returncode != 0:
            logger.error("FFmpeg instrumental fallback also failed: %s", result2.stderr[:300])
            shutil.copy(audio_path, instrumental_out)

    # --- Vocals: center extraction (L+R average) with bandpass for vocal range ---
    cmd_vocals = [
        "ffmpeg", "-y", "-i", audio_path,
        "-af",
        "pan=mono|c0=0.5*c0+0.5*c1,"
        "highpass=f=150,"
        "lowpass=f=8000,"
        "aformat=channel_layouts=mono",
        "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1",
        vocals_out,
    ]
    logger.info("FFmpeg vocals: %s", " ".join(cmd_vocals))
    result = subprocess.run(cmd_vocals, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("FFmpeg vocal extraction failed: %s", result.stderr[:500])
        shutil.copy(audio_path, vocals_out)

    return {"vocals": vocals_out, "instrumental": instrumental_out}


# ---------------------------------------------------------------------------
# Stage 3: transcription with word-level timestamps
# ---------------------------------------------------------------------------
def transcribe_with_timestamps(audio_path: str) -> List[Dict[str, Any]]:
    """
    Returns list of segments:
        [{ start, end, text, words: [{word, start, end}, ...] }, ...]
    """
    if MOCK_AI:
        return _mock_transcription(audio_path)

    if HAS_WHISPER:
        return _whisper_transcription(audio_path)

    logger.info("Whisper not available — using mock transcription")
    return _mock_transcription(audio_path)


def _whisper_transcription(audio_path: str) -> List[Dict[str, Any]]:
    """Real Whisper transcription with word-level timestamps."""
    try:
        from transcribe.whisper_service import transcribe
        result = transcribe(audio_path, word_timestamps=True)
        return result.get("segments", []) if isinstance(result, dict) else result
    except Exception as e:
        logger.error("Whisper transcription failed: %s — falling back to mock", e)
        return _mock_transcription(audio_path)


def _get_audio_duration(audio_path: str) -> float:
    """Get audio duration using ffprobe."""
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path,
        ]).decode().strip()
        return float(out)
    except Exception:
        return 30.0


def _detect_vocal_segments(audio_path: str, duration: float) -> List[Dict[str, float]]:
    """
    Analyse the extracted vocal center-channel audio to find segments where
    energy is above average (i.e. someone is likely singing).

    Returns list of {'start': float, 'end': float} representing vocal activity
    windows, each at least 1.5 seconds long, with gaps merged.
    """
    try:
        wf = wave.open(audio_path, "rb")
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()

        # Read in 0.25 s chunks to build an energy profile
        chunk_sec = 0.25
        chunk_frames = int(framerate * chunk_sec)
        energies = []
        times = []

        pos = 0
        while pos < n_frames:
            to_read = min(chunk_frames, n_frames - pos)
            raw = wf.readframes(to_read)
            if sampwidth == 2:
                fmt = f"<{to_read * n_channels}h"
                samples = struct.unpack(fmt, raw)
            else:
                samples = list(raw)
            rms = (sum(s * s for s in samples) / max(len(samples), 1)) ** 0.5
            energies.append(rms)
            times.append(pos / framerate)
            pos += to_read
        wf.close()

        if not energies:
            return []

        # Use median-based threshold for better discrimination.
        # Vocal sections are louder than silent/instrumental-only sections.
        sorted_e = sorted(energies)
        max_e = sorted_e[-1] if sorted_e else 1
        median_e = sorted_e[len(sorted_e) // 2]
        # Threshold: halfway between median and max, but at least 30% of max
        threshold = max(median_e + (max_e - median_e) * 0.35, max_e * 0.30)
        active = [e > threshold for e in energies]

        # Convert active flags to contiguous segments, merging gaps < 0.8s
        segments = []
        in_seg = False
        seg_start = 0.0
        for i, on in enumerate(active):
            t = times[i]
            if on and not in_seg:
                seg_start = t
                in_seg = True
            elif not on and in_seg:
                seg_end = t
                # Check if this gap is short enough to merge
                # Look ahead: if next active frame is within 0.8s, keep going
                gap_merge = False
                for j in range(i + 1, min(i + int(0.8 / chunk_sec) + 2, len(active))):
                    if active[j]:
                        gap_merge = True
                        break
                if not gap_merge:
                    if seg_end - seg_start >= 1.0:
                        segments.append({"start": round(seg_start, 2), "end": round(seg_end, 2)})
                    in_seg = False
        if in_seg:
            seg_end = min(times[-1] + chunk_sec, duration)
            if seg_end - seg_start >= 1.0:
                segments.append({"start": round(seg_start, 2), "end": round(seg_end, 2)})

        logger.info("Detected %d vocal-activity segments from audio energy", len(segments))
        return segments

    except Exception as e:
        logger.warning("Vocal segment detection failed: %s — falling back to uniform", e)
        return []


def _mock_transcription(audio_path: str) -> List[Dict[str, Any]]:
    """
    Generate word-level timed lyrics.

    Without Whisper we can't know the actual words, but we CAN detect *when*
    vocals are happening by analysing energy in the center channel.  We place
    placeholder lyric lines on top of those windows so the karaoke highlighting
    visually tracks the singing.  The result is "lyrics" that aren't real but
    the timing of highlighted words matches the actual vocal rhythm.
    """
    duration = _get_audio_duration(audio_path)

    # Try to detect where vocals actually happen
    vocal_windows = _detect_vocal_segments(audio_path, duration)

    demo_lines = [
        "Singing along to the melody tonight",
        "Every note is shining in the light",
        "Feel the rhythm flowing through the air",
        "Voices rising up without a care",
        "Dancing with the words upon the stage",
        "Turning every moment to a page",
        "Harmonies are echoing around",
        "Lost inside the beauty of the sound",
        "Let the music carry us away",
        "This is where we always want to stay",
        "Stars are falling gently from above",
        "Wrapped inside a song of endless love",
        "Chasing every dream that starts to glow",
        "Letting all the melodies just flow",
        "Singing out until the morning breaks",
        "Every beat a memory it makes",
    ]

    segments = []

    if vocal_windows and len(vocal_windows) >= 1:
        # Distribute lyrics across detected vocal segments
        line_idx = 0
        for vw in vocal_windows:
            win_dur = vw["end"] - vw["start"]
            # Split long windows into ~3-4 second sub-lines
            n_lines_in_window = max(1, int(win_dur / 3.5))
            sub_dur = win_dur / n_lines_in_window

            for sub in range(n_lines_in_window):
                if line_idx >= len(demo_lines):
                    line_idx = 0  # wrap around
                line = demo_lines[line_idx]
                line_idx += 1

                seg_start = vw["start"] + sub * sub_dur
                seg_end = seg_start + sub_dur - 0.15
                if seg_end <= seg_start + 0.5:
                    continue

                words_in_line = line.split()
                word_dur = (seg_end - seg_start) / len(words_in_line)

                words = []
                for j, w in enumerate(words_in_line):
                    ws = seg_start + j * word_dur
                    we = ws + word_dur * 0.88
                    words.append({
                        "word": w,
                        "start": round(ws, 3),
                        "end": round(we, 3),
                    })
                segments.append({
                    "start": round(seg_start, 3),
                    "end": round(seg_end, 3),
                    "text": line,
                    "words": words,
                })
    else:
        # Fallback: evenly distribute lyrics across the audio duration
        n = min(len(demo_lines), max(6, int(duration / 4)))
        usable = max(duration - 3.0, n * 2.0)
        seg_dur = usable / n
        gap = min(0.4, seg_dur * 0.1)

        for i in range(n):
            line = demo_lines[i % len(demo_lines)]
            seg_start = 2.0 + i * seg_dur
            seg_end = min(seg_start + seg_dur - gap, duration - 0.5)
            if seg_start >= duration:
                break

            words_in_line = line.split()
            active_dur = seg_end - seg_start
            word_dur = active_dur / len(words_in_line)

            words = []
            for j, w in enumerate(words_in_line):
                ws = seg_start + j * word_dur
                we = ws + word_dur * 0.88
                words.append({
                    "word": w,
                    "start": round(ws, 3),
                    "end": round(we, 3),
                })
            segments.append({
                "start": round(seg_start, 3),
                "end": round(seg_end, 3),
                "text": line,
                "words": words,
            })

    return segments


# ---------------------------------------------------------------------------
# Stage 4: ASS subtitle generation with karaoke timing
# ---------------------------------------------------------------------------
ASS_HEADER = r"""[Script Info]
Title: Karaoke - VidForge AI
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
ScaledBorderAndShadow: yes
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,Arial,52,&H00FFFFFF,&H0000D4FF,&H00000000,&HC8000000,-1,0,0,0,100,100,1,0,1,3,2,2,50,50,55,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def _ass_time(t: float) -> str:
    """Convert seconds to ASS timestamp format H:MM:SS.cc"""
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def generate_ass(segments: List[Dict[str, Any]], out_path: str) -> str:
    """
    Build an ASS file with \\kf karaoke tags so each word fills with color
    progressively (smooth fill effect).

    ASS karaoke tags:
      \\k<N>   — instant highlight after N centiseconds
      \\kf<N>  — smooth left-to-right fill over N centiseconds
      \\ko<N>  — outline highlight over N centiseconds

    We add a short fade-in (\\fad) at the start of each line so lyrics appear
    smoothly, and use \\kf for the progressive word fill.
    """
    lines = [ASS_HEADER.strip()]

    for idx, seg in enumerate(segments):
        if not seg.get("words"):
            continue

        # Show subtitle slightly early (0.3s) so viewer can anticipate
        display_start = max(0, seg["start"] - 0.3)
        start = _ass_time(display_start)
        end = _ass_time(seg["end"] + 0.2)

        # Calculate pre-roll: time before first word starts highlighting
        pre_cs = max(int((seg["start"] - display_start) * 100), 0)

        # Build karaoke text with \kf (smooth fill) tags
        karaoke_parts = []
        if pre_cs > 0:
            # Silent wait before first word highlight starts
            karaoke_parts.append(f"{{\\k{pre_cs}}}")

        for i, w in enumerate(seg["words"]):
            dur_cs = max(int((w["end"] - w["start"]) * 100), 8)
            # Add a tiny inter-word gap (2 centiseconds) for visual clarity
            if i > 0:
                gap_cs = max(int((w["start"] - seg["words"][i - 1]["end"]) * 100), 2)
                if gap_cs > 2:
                    karaoke_parts.append(f"{{\\k{gap_cs}}}")
            karaoke_parts.append(f"{{\\kf{dur_cs}}}{w['word']}")

        # Fade-in 200ms / fade-out 300ms for smooth appearance
        text = "{\\fad(200,300)}" + " ".join(karaoke_parts)
        lines.append(f"Dialogue: 0,{start},{end},Karaoke,,0,0,0,,{text}")

    content = "\n".join(lines) + "\n"
    Path(out_path).write_text(content, encoding="utf-8")
    logger.info("ASS subtitle generated: %s (%d segments)", out_path, len(segments))
    return out_path


# ---------------------------------------------------------------------------
# Stage 5: mux video + instrumental + subtitles
# ---------------------------------------------------------------------------
def mux_karaoke(
    video_path: str,
    instrumental_path: str,
    ass_path: str,
    out_path: str,
) -> str:
    """
    Burn ASS subtitles into the video and replace audio with the instrumental.
    Uses the subtitles filter (hardcoded subs — works everywhere, no font issues).
    """
    # Escape the ASS path for ffmpeg filter syntax
    safe_ass = (
        ass_path
        .replace("\\", "/")
        .replace(":", "\\:")
        .replace("'", "\\'")
    )
    vf = f"ass='{safe_ass}'"

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", instrumental_path,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        out_path,
    ]
    logger.info("FFmpeg mux: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg mux failed: {result.stderr[:800]}")
    if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
        raise RuntimeError("FFmpeg mux produced no output")
    logger.info(
        "Karaoke video rendered: %s (%d bytes)",
        out_path, os.path.getsize(out_path),
    )
    return out_path


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------
def run_pipeline(
    video_path: str,
    output_path: str,
    progress_cb: Optional[Callable[[int, str], None]] = None,
) -> Dict[str, Any]:
    """
    Execute the full karaoke pipeline.
    progress_cb(percent, label) is called for UI updates.

    Returns:
      {
        "output": str,          # path to final mp4
        "segments": [...],      # word-level lyrics data
        "mock": bool,           # whether mock AI was used
        "separation_method": str,  # "demucs" | "ffmpeg" | "mock"
        "transcription_method": str,  # "whisper" | "mock"
      }
    """
    def report(p: int, label: str):
        logger.info("[karaoke] %d%%  %s", p, label)
        if progress_cb:
            try:
                progress_cb(p, label)
            except Exception:
                pass

    work = tempfile.mkdtemp(prefix="karaoke_")
    separation_method = "mock"
    transcription_method = "mock"

    try:
        # --- Stage 1: Extract audio (0-10%) ---
        report(5, "Extracting audio from video")
        wav = extract_audio(video_path, os.path.join(work, "audio.wav"))
        report(10, "Audio extracted")

        # --- Stage 2: Vocal separation (10-50%) ---
        report(15, "Separating vocals from instrumental")
        stems = separate_vocals(wav, os.path.join(work, "stems"))
        report(50, "Vocal separation complete")

        if MOCK_AI:
            separation_method = "mock"
        elif HAS_DEMUCS:
            separation_method = "demucs"
        else:
            separation_method = "ffmpeg"

        # --- Stage 3: Transcription (50-75%) ---
        report(55, "Transcribing lyrics")
        segments = transcribe_with_timestamps(stems["vocals"])
        report(75, "Lyrics transcribed")

        if not MOCK_AI and HAS_WHISPER:
            transcription_method = "whisper"

        # --- Stage 4: ASS subtitle generation (75-80%) ---
        report(78, "Generating karaoke subtitles")
        ass_path = generate_ass(segments, os.path.join(work, "lyrics.ass"))
        report(80, "Subtitles ready")

        # --- Stage 5: Render final video (80-100%) ---
        report(85, "Rendering karaoke video")
        mux_karaoke(video_path, stems["instrumental"], ass_path, output_path)
        report(100, "Done")

        return {
            "output": output_path,
            "segments": segments,
            "mock": MOCK_AI,
            "separation_method": separation_method,
            "transcription_method": transcription_method,
        }
    except Exception as e:
        logger.exception("Karaoke pipeline failed")
        raise
    finally:
        shutil.rmtree(work, ignore_errors=True)
