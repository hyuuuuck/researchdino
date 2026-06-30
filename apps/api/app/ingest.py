import hashlib
import importlib.util
from datetime import datetime
from pathlib import Path
from typing import Any


def current_iso_time() -> str:
    return datetime.now().isoformat(timespec="seconds")


def current_clock_time() -> str:
    return datetime.now().strftime("%H:%M")


def is_pymupdf_available() -> bool:
    return importlib.util.find_spec("fitz") is not None


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_pdf_text(path: Path) -> dict[str, Any]:
    if not is_pymupdf_available():
        return {
            "status": "parser_unavailable",
            "pageCount": None,
            "text": None,
            "textPreview": None,
            "errorMessage": "PyMuPDF is not installed in the current Python environment.",
        }

    try:
        import fitz  # type: ignore[import-not-found]

        parts: list[str] = []
        with fitz.open(path) as document:
            for page in document:
                parts.append(page.get_text("text"))
            text = "\n\n".join(parts).strip()
            return {
                "status": "parsed",
                "pageCount": document.page_count,
                "text": text,
                "textPreview": text[:800],
                "errorMessage": None,
            }
    except Exception as error:  # pragma: no cover - depends on user PDF files.
        return {
            "status": "failed",
            "pageCount": None,
            "text": None,
            "textPreview": None,
            "errorMessage": str(error),
        }


def scan_pdf_folder(folder_path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    scanned_at = current_iso_time()
    paper_records: list[dict[str, Any]] = []
    card_records: list[dict[str, Any]] = []
    text_records: list[dict[str, Any]] = []

    for pdf_path in sorted(folder_path.rglob("*.pdf")):
        try:
            stat = pdf_path.stat()
            file_hash = sha256_file(pdf_path)
            paper_id = f"paper-file-{file_hash[:16]}"
            extraction = extract_pdf_text(pdf_path)
            record = {
                "id": paper_id,
                "path": str(pdf_path),
                "fileName": pdf_path.name,
                "sizeBytes": stat.st_size,
                "sha256": file_hash,
                "scanStatus": "scanned",
                "textExtractionStatus": extraction["status"],
                "pageCount": extraction["pageCount"],
                "textPreview": extraction["textPreview"],
                "errorMessage": extraction["errorMessage"],
                "scannedAt": scanned_at,
            }
            paper_records.append(record)

            if extraction["text"]:
                text_records.append(
                    {
                        "id": paper_id,
                        "paperFileId": paper_id,
                        "text": extraction["text"],
                        "pageCount": extraction["pageCount"],
                        "extractedAt": scanned_at,
                    }
                )

            card_records.append(card_from_paper_record(record))
        except Exception as error:  # pragma: no cover - depends on local filesystem.
            paper_id = f"paper-error-{hashlib.sha256(str(pdf_path).encode()).hexdigest()[:16]}"
            record = {
                "id": paper_id,
                "path": str(pdf_path),
                "fileName": pdf_path.name,
                "sizeBytes": 0,
                "sha256": None,
                "scanStatus": "error",
                "textExtractionStatus": "failed",
                "pageCount": None,
                "textPreview": None,
                "errorMessage": str(error),
                "scannedAt": scanned_at,
            }
            paper_records.append(record)
            card_records.append(card_from_paper_record(record))

    return paper_records, card_records, text_records


def card_from_paper_record(record: dict[str, Any]) -> dict[str, Any]:
    failed = record["scanStatus"] == "error" or record["textExtractionStatus"] == "failed"
    parser_missing = record["textExtractionStatus"] == "parser_unavailable"
    card_type = "error" if failed else "paper"

    return {
        "id": f"card-{record['id']}",
        "title": record["fileName"],
        "type": card_type,
        "currentRoom": "collection",
        "status": "failed" if failed else "queued",
        "progress": 0 if failed else 10,
        "assignedAgent": "collector",
        "lastAgent": "collector",
        "lastUpdated": current_clock_time(),
        "requiresUserReview": False,
        "errorMessage": record["errorMessage"],
        "sourcePaperId": record["id"],
        "evidenceCount": 0,
        "approvalStatus": "draft",
        "summary": summary_for_record(record),
        "details": {
            "File": record["fileName"],
            "Path": record["path"],
            "Size bytes": record["sizeBytes"],
            "SHA-256": record["sha256"] or "not available",
            "Scan status": record["scanStatus"],
            "Text extraction": record["textExtractionStatus"],
            "Parser note": "Install PyMuPDF to extract text." if parser_missing else "ready",
        },
    }


def summary_for_record(record: dict[str, Any]) -> str:
    if record["scanStatus"] == "error":
        return "Local PDF scan failed. See error details before retrying."
    if record["textExtractionStatus"] == "parser_unavailable":
        return "Local PDF was scanned and hashed. Text extraction awaits PyMuPDF."
    if record["textExtractionStatus"] == "failed":
        return "Local PDF was scanned, but text extraction failed."
    if record["textExtractionStatus"] == "parsed":
        return "Local PDF was scanned, hashed, and parsed into text."
    return "Local PDF was scanned and registered."
