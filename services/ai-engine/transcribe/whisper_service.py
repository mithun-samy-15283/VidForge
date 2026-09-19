"""Whisper-based transcription with word-level timestamps."""
import whisper
from functools import lru_cache

@lru_cache(maxsize=1)
def _model():
    # Switch to "small"/"medium" for accuracy, "tiny" for speed
    return whisper.load_model("base")

def transcribe(audio_path: str, language=None, word_timestamps: bool = True):
    model = _model()
    result = model.transcribe(
        audio_path,
        language=language,
        word_timestamps=True,
        verbose=False
    )
    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"].strip(),
            "words": [
                {"word": w["word"], "start": w["start"], "end": w["end"]}
                for w in seg.get("words", [])
            ]
        })
    return {"language": result.get("language"), "text": result.get("text"), "segments": segments}
