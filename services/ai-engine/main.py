"""
VidForge AI Engine — FastAPI service.

Endpoints:
  GET  /health              -> service status + capabilities
  POST /karaoke             -> upload a video and start the karaoke pipeline
  GET  /jobs/{job_id}       -> poll job progress / result
  GET  /jobs/{job_id}/file  -> download completed output
"""

import os
import shutil
import uuid
import logging
import threading
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from karaoke.pipeline import (
    run_pipeline,
    MOCK_AI,
    HAS_DEMUCS,
    HAS_WHISPER,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-engine")

app = FastAPI(title="VidForge AI Engine", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store. For production, swap for Redis.
JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()

OUTPUT_DIR = Path(os.getenv("AI_OUTPUT_DIR", "/tmp/vidforge-ai-output"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
INPUT_DIR = OUTPUT_DIR / "inputs"
INPUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class JobStatus(BaseModel):
    id: str
    state: str  # queued | running | completed | failed
    progress: int
    label: str
    output: Optional[str] = None
    error: Optional[str] = None
    mock: bool = False
    separation_method: Optional[str] = None
    transcription_method: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _update_job(job_id: str, **fields):
    with JOBS_LOCK:
        if job_id in JOBS:
            JOBS[job_id].update(fields)


def _run_karaoke_job(job_id: str, video_path: str, output_path: str):
    _update_job(job_id, state="running", progress=1, label="Starting pipeline")
    try:
        def cb(p: int, label: str):
            _update_job(job_id, progress=p, label=label)

        result = run_pipeline(video_path, output_path, progress_cb=cb)
        _update_job(
            job_id,
            state="completed",
            progress=100,
            label="Done",
            output=result["output"],
            mock=result.get("mock", False),
            separation_method=result.get("separation_method"),
            transcription_method=result.get("transcription_method"),
        )
    except Exception as e:
        logger.exception("karaoke job %s failed", job_id)
        _update_job(job_id, state="failed", error=str(e), label="Failed")
    finally:
        Path(video_path).unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-engine",
        "version": "0.2.0",
        "mock_mode": MOCK_AI,
        "has_demucs": HAS_DEMUCS,
        "has_whisper": HAS_WHISPER,
        "separation_backend": (
            "mock" if MOCK_AI else ("demucs" if HAS_DEMUCS else "ffmpeg")
        ),
        "transcription_backend": (
            "mock" if MOCK_AI else ("whisper" if HAS_WHISPER else "mock")
        ),
        "output_dir": str(OUTPUT_DIR),
    }


@app.post("/karaoke", response_model=JobStatus)
async def create_karaoke_job(
    video: UploadFile = File(...),
    output_filename: Optional[str] = Form(None),
):
    job_id = uuid.uuid4().hex[:12]
    suffix = Path(video.filename or "").suffix[:10] or ".mp4"
    input_path = INPUT_DIR / f"{job_id}{suffix}"
    with input_path.open("wb") as target:
        shutil.copyfileobj(video.file, target)
    await video.close()

    if input_path.stat().st_size == 0:
        input_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="uploaded video is empty")

    out_name = Path(output_filename or f"{job_id}.mp4").name
    output_path = str(OUTPUT_DIR / out_name)

    with JOBS_LOCK:
        JOBS[job_id] = {
            "id": job_id,
            "state": "queued",
            "progress": 0,
            "label": "Queued",
            "output": None,
            "error": None,
            "mock": MOCK_AI,
            "separation_method": None,
            "transcription_method": None,
        }

    t = threading.Thread(
        target=_run_karaoke_job,
        args=(job_id, str(input_path), output_path),
        daemon=True,
    )
    t.start()

    return JobStatus(**JOBS[job_id])


@app.get("/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return JobStatus(**job)


@app.get("/jobs/{job_id}/file")
def get_job_file(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    if job["state"] != "completed":
        raise HTTPException(status_code=409, detail="job not completed")

    output = job.get("output")
    if not output or not os.path.isfile(output):
        raise HTTPException(status_code=404, detail="output file not found")
    return FileResponse(output, filename=Path(output).name, media_type="video/mp4")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", os.getenv("AI_PORT", "5000"))),
        reload=False,
    )
