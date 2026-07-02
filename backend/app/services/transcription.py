"""
Transcription Service
Supports:
  1. OpenAI Whisper API (cloud) — primary
  2. Local openai-whisper model — fallback if no API key or cloud fails
  3. Mock transcription — always-works fallback for development
"""
import os
import tempfile
from typing import Optional


def transcribe_audio(file_path: str, api_key: Optional[str] = None, language: str = "en") -> str:
    """
    Transcribe an audio file to text.
    Tries OpenAI Whisper API → local whisper → mock fallback.
    """
    resolved_key = api_key or os.getenv("OPENAI_API_KEY", "")
    is_real_key = resolved_key and not resolved_key.startswith("super-secret") and "mock" not in resolved_key.lower()

    # --- Attempt 1: OpenAI Whisper API ---
    if is_real_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=resolved_key)
            with open(file_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language=language,
                    response_format="text"
                )
            print(f"[Transcription] OpenAI Whisper API transcription complete.")
            return str(response)
        except Exception as e:
            print(f"[Transcription] OpenAI Whisper API failed: {e}. Trying local whisper...")

    # --- Attempt 2: Local whisper model ---
    try:
        import whisper  # openai-whisper package
        model = whisper.load_model("base")
        result = model.transcribe(file_path, language=language)
        print(f"[Transcription] Local whisper transcription complete.")
        return result["text"]
    except ImportError:
        print("[Transcription] openai-whisper not installed. Using mock transcription.")
    except Exception as e:
        print(f"[Transcription] Local whisper failed: {e}. Using mock transcription.")

    # --- Attempt 3: Mock fallback ---
    return _mock_transcription(file_path)


def transcribe_meeting(file_path: str, api_key: Optional[str] = None, language: str = "en") -> str:
    """
    Transcribe a meeting recording (audio or video).
    For video files, attempts to extract audio first.
    """
    ext = os.path.splitext(file_path)[1].lower()
    audio_path = file_path

    # If video file, try to extract audio track
    if ext in [".mp4", ".avi", ".mov", ".mkv", ".webm"]:
        audio_path = _extract_audio_from_video(file_path)

    return transcribe_audio(audio_path, api_key=api_key, language=language)


def _extract_audio_from_video(video_path: str) -> str:
    """Extract audio from video using ffmpeg. Returns path to extracted audio file."""
    try:
        import subprocess
        audio_path = video_path.rsplit(".", 1)[0] + "_audio.mp3"
        result = subprocess.run(
            ["ffmpeg", "-i", video_path, "-q:a", "0", "-map", "a", audio_path, "-y"],
            capture_output=True, timeout=120
        )
        if result.returncode == 0 and os.path.exists(audio_path):
            print(f"[Transcription] Audio extracted from video: {audio_path}")
            return audio_path
        else:
            print(f"[Transcription] ffmpeg extraction failed. Using video path directly.")
            return video_path
    except Exception as e:
        print(f"[Transcription] Audio extraction error: {e}. Using original path.")
        return video_path


def _mock_transcription(file_path: str) -> str:
    """Returns a realistic mock transcription for development/testing."""
    filename = os.path.basename(file_path)
    return (
        f"[Mock Transcription for: {filename}]\n\n"
        "Good morning everyone. Thank you for joining today's meeting. "
        "Let's start with the agenda for today. First, we'll review the Q3 product roadmap updates. "
        "The team has made significant progress on the AI feature integration. "
        "Voice RAG capabilities are now in testing phase. The OCR intelligence module has been deployed. "
        "Action item: John will finalize the deployment documentation by Friday. "
        "Decision: We approved the budget increase for the GPU cluster expansion. "
        "Action item: Sarah to coordinate with DevOps for the infrastructure scaling. "
        "Next steps: The research team will present their findings in the next sprint. "
        "Meeting adjourned at 10:45 AM."
    )
