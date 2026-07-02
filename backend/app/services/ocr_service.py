"""
OCR Intelligence Service
Supports:
  1. GPT-4 Vision (cloud) — primary, best accuracy
  2. pytesseract + pdf2image — local fallback
  3. Mock OCR — always-works fallback for development
"""
import os
import tempfile
import base64
from typing import Optional, List, Dict, Any


def ocr_pdf(file_path: str, api_key: Optional[str] = None) -> str:
    """
    Extract text from a scanned PDF using OCR.
    Tries GPT-4 Vision → pytesseract → mock.
    Returns extracted text as a single string.
    """
    resolved_key = api_key or os.getenv("OPENAI_API_KEY", "")
    is_real_key = resolved_key and not resolved_key.startswith("super-secret") and "mock" not in resolved_key.lower()

    # --- Attempt 1: GPT-4 Vision OCR ---
    if is_real_key:
        try:
            pages = _pdf_to_images(file_path)
            if pages:
                texts = []
                for page_num, img_path in enumerate(pages, 1):
                    text = _gpt4_vision_ocr(img_path, resolved_key, page_num)
                    texts.append(f"=== Page {page_num} ===\n{text}")
                    # Clean up temp image
                    try:
                        os.remove(img_path)
                    except Exception:
                        pass
                print(f"[OCR] GPT-4 Vision OCR complete: {len(pages)} pages processed.")
                return "\n\n".join(texts)
        except Exception as e:
            print(f"[OCR] GPT-4 Vision OCR failed: {e}. Trying pytesseract...")

    # --- Attempt 2: pytesseract ---
    try:
        import pytesseract
        from PIL import Image
        pages = _pdf_to_images(file_path)
        if pages:
            texts = []
            for page_num, img_path in enumerate(pages, 1):
                img = Image.open(img_path)
                text = pytesseract.image_to_string(img)
                texts.append(f"=== Page {page_num} ===\n{text}")
                try:
                    os.remove(img_path)
                except Exception:
                    pass
            print(f"[OCR] pytesseract OCR complete: {len(pages)} pages processed.")
            return "\n\n".join(texts)
    except ImportError:
        print("[OCR] pytesseract not installed. Using mock OCR.")
    except Exception as e:
        print(f"[OCR] pytesseract failed: {e}. Using mock OCR.")

    # --- Attempt 3: Mock fallback ---
    return _mock_ocr(file_path)


def ocr_image(file_path: str, api_key: Optional[str] = None) -> str:
    """
    Extract text from a single scanned image.
    Tries GPT-4 Vision → pytesseract → mock.
    """
    resolved_key = api_key or os.getenv("OPENAI_API_KEY", "")
    is_real_key = resolved_key and not resolved_key.startswith("super-secret") and "mock" not in resolved_key.lower()

    # --- Attempt 1: GPT-4 Vision ---
    if is_real_key:
        try:
            text = _gpt4_vision_ocr(file_path, resolved_key, 1)
            print(f"[OCR] GPT-4 Vision image OCR complete.")
            return text
        except Exception as e:
            print(f"[OCR] GPT-4 Vision image OCR failed: {e}. Trying pytesseract...")

    # --- Attempt 2: pytesseract ---
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        print(f"[OCR] pytesseract image OCR complete.")
        return text
    except ImportError:
        print("[OCR] pytesseract not installed. Using mock OCR.")
    except Exception as e:
        print(f"[OCR] pytesseract failed: {e}.")

    return _mock_ocr(file_path)


def _pdf_to_images(pdf_path: str) -> List[str]:
    """Convert PDF pages to image files. Returns list of temp image paths."""
    try:
        from pdf2image import convert_from_path
        tmp_dir = tempfile.mkdtemp()
        images = convert_from_path(pdf_path, dpi=200, output_folder=tmp_dir, fmt="png")
        saved_paths = []
        for i, img in enumerate(images):
            img_path = os.path.join(tmp_dir, f"page_{i + 1}.png")
            img.save(img_path, "PNG")
            saved_paths.append(img_path)
        return saved_paths
    except ImportError:
        print("[OCR] pdf2image not installed. Cannot convert PDF to images.")
        return []
    except Exception as e:
        print(f"[OCR] PDF to images conversion failed: {e}")
        return []


def _gpt4_vision_ocr(image_path: str, api_key: str, page_num: int) -> str:
    """Use GPT-4 Vision to extract text from an image."""
    from openai import OpenAI
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    ext = os.path.splitext(image_path)[1].lower().lstrip(".")
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}
    mime_type = mime_map.get(ext, "image/png")

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Please extract ALL text from this document image (page {page_num}). "
                                "Return only the extracted text, preserving the original structure as much as possible. "
                                "Do not add any commentary or explanation."
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{image_data}"}
                    }
                ]
            }
        ],
        max_tokens=4096
    )
    return response.choices[0].message.content or ""


def _mock_ocr(file_path: str) -> str:
    """Returns realistic mock OCR text for development/testing."""
    filename = os.path.basename(file_path)
    return (
        f"[Mock OCR Extraction for: {filename}]\n\n"
        "=== Page 1 ===\n"
        "ENTERPRISE POLICY DOCUMENT\n"
        "Document Reference: EPD-2024-001\n\n"
        "Section 1: Introduction\n"
        "This document outlines the enterprise data governance and AI usage policies "
        "applicable to all employees and contractors. Compliance with these policies is mandatory.\n\n"
        "=== Page 2 ===\n"
        "Section 2: Data Classification\n"
        "All enterprise data must be classified into one of the following categories:\n"
        "- Public: Information freely shareable\n"
        "- Internal: For internal use only\n"
        "- Confidential: Restricted to authorized personnel\n"
        "- Top Secret: Highest restriction level\n\n"
        "Section 3: AI System Usage Guidelines\n"
        "Employees using AI-powered tools must ensure data privacy compliance at all times. "
        "Sensitive customer data must never be uploaded to external AI systems without explicit approval.\n\n"
        "=== Page 3 ===\n"
        "Appendix A: Compliance Checklist\n"
        "☑ Data anonymization before AI processing\n"
        "☑ Audit trail maintained for all AI interactions\n"
        "☑ Regular policy review every 6 months\n\n"
        "Document approved by: Chief Information Security Officer\n"
        "Date: January 2024"
    )
