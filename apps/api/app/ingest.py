from __future__ import annotations

import hashlib
import importlib.util
import re
from datetime import datetime
from pathlib import Path
from typing import Any


DOI_PATTERN = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)


def current_iso_time() -> str:
    return datetime.now().isoformat(timespec="seconds")


def current_clock_time() -> str:
    return datetime.now().strftime("%H:%M")


def is_pymupdf_available() -> bool:
    return (
        importlib.util.find_spec("pymupdf") is not None
        or importlib.util.find_spec("fitz") is not None
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def scope_token(project_id: str, lab_id: str | None) -> str:
    scope = f"{project_id}|{lab_id or 'project'}"
    return hashlib.sha256(scope.encode("utf-8")).hexdigest()[:8]


def scoped_paper_id(file_hash: str, project_id: str, lab_id: str | None) -> str:
    return f"paper-file-{file_hash[:16]}-{scope_token(project_id, lab_id)}"


def clean_metadata_value(value: Any) -> str:
    return str(value or "").strip()


def split_metadata_values(value: str) -> list[str]:
    if not value:
        return []
    separator = ";" if ";" in value else "\n" if "\n" in value else None
    if separator is None:
        return [value.strip()]
    return [item.strip() for item in value.split(separator) if item.strip()]


def split_keywords(value: str) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in re.split(r"[;,]", value) if item.strip()]


def detect_doi(*values: str) -> str | None:
    for value in values:
        if not value:
            continue
        match = DOI_PATTERN.search(value)
        if match:
            return match.group(0).rstrip(".,;:)]}>")
    return None


def extract_pdf_text(path: Path) -> dict[str, Any]:
    if not is_pymupdf_available():
        return {
            "status": "parser_unavailable",
            "pageCount": None,
            "text": None,
            "pages": [],
            "textPreview": None,
            "textLength": 0,
            "metadata": {},
            "title": path.stem,
            "authors": [],
            "doi": None,
            "subject": None,
            "keywords": [],
            "metadataSource": "filename",
            "errorMessage": "PyMuPDF is not installed in the current Python environment.",
        }

    try:
        try:
            import pymupdf as fitz  # type: ignore[import-not-found]
        except ImportError:  # pragma: no cover - compatibility with older PyMuPDF.
            import fitz  # type: ignore[import-not-found,no-redef]

        parts: list[str] = []
        pages: list[dict[str, Any]] = []
        with fitz.open(path) as document:
            raw_metadata = document.metadata or {}
            metadata = {
                key: clean_metadata_value(value)
                for key, value in raw_metadata.items()
                if clean_metadata_value(value)
            }

            cursor = 0
            for page_number, page in enumerate(document, start=1):
                page_text = page.get_text("text").strip()
                if parts:
                    cursor += 2
                start = cursor
                parts.append(page_text)
                cursor += len(page_text)
                pages.append(
                    {
                        "pageNumber": page_number,
                        "text": page_text,
                        "charStart": start,
                        "charEnd": cursor,
                    }
                )

            text = "\n\n".join(parts).strip()
            embedded_title = clean_metadata_value(metadata.get("title"))
            title = embedded_title if embedded_title.lower() not in {"", "untitled"} else path.stem
            author_text = clean_metadata_value(metadata.get("author"))
            subject = clean_metadata_value(metadata.get("subject")) or None
            keyword_text = clean_metadata_value(metadata.get("keywords"))
            doi = detect_doi(
                embedded_title,
                subject or "",
                keyword_text,
                text[:20000],
            )

            return {
                "status": "parsed",
                "pageCount": document.page_count,
                "text": text,
                "pages": pages,
                "textPreview": text[:800] or None,
                "textLength": len(text),
                "metadata": metadata,
                "title": title,
                "authors": split_metadata_values(author_text),
                "doi": doi,
                "subject": subject,
                "keywords": split_keywords(keyword_text),
                "metadataSource": "embedded_pdf" if embedded_title or author_text else "filename",
                "errorMessage": None,
            }
    except Exception as error:  # pragma: no cover - depends on user PDF files.
        return {
            "status": "failed",
            "pageCount": None,
            "text": None,
            "pages": [],
            "textPreview": None,
            "textLength": 0,
            "metadata": {},
            "title": path.stem,
            "authors": [],
            "doi": None,
            "subject": None,
            "keywords": [],
            "metadataSource": "filename",
            "errorMessage": str(error),
        }


def scan_pdf_folder(
    folder_path: Path,
    project_id: str = "project-autophagy",
    lab_id: str | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    scanned_at = current_iso_time()
    paper_records: list[dict[str, Any]] = []
    card_records: list[dict[str, Any]] = []
    text_records: list[dict[str, Any]] = []

    for pdf_path in sorted(folder_path.rglob("*.pdf")):
        try:
            stat = pdf_path.stat()
            file_hash = sha256_file(pdf_path)
            paper_id = scoped_paper_id(file_hash, project_id, lab_id)
            extraction = extract_pdf_text(pdf_path)
            record = {
                "id": paper_id,
                "projectId": project_id,
                "labId": lab_id,
                "path": str(pdf_path),
                "fileName": pdf_path.name,
                "title": extraction["title"],
                "authors": extraction["authors"],
                "doi": extraction["doi"],
                "subject": extraction["subject"],
                "keywords": extraction["keywords"],
                "metadataSource": extraction["metadataSource"],
                "pdfMetadata": extraction["metadata"],
                "sizeBytes": stat.st_size,
                "sha256": file_hash,
                "scanStatus": "scanned",
                "textExtractionStatus": extraction["status"],
                "pageCount": extraction["pageCount"],
                "textLength": extraction["textLength"],
                "textPreview": extraction["textPreview"],
                "errorMessage": extraction["errorMessage"],
                "scannedAt": scanned_at,
            }
            paper_records.append(record)

            if extraction["text"] is not None:
                text_records.append(
                    {
                        "id": paper_id,
                        "projectId": project_id,
                        "labId": lab_id,
                        "paperFileId": paper_id,
                        "text": extraction["text"],
                        "pages": extraction["pages"],
                        "pageCount": extraction["pageCount"],
                        "textLength": extraction["textLength"],
                        "extractedAt": scanned_at,
                    }
                )

            card_records.append(card_from_paper_record(record))
        except Exception as error:  # pragma: no cover - depends on local filesystem.
            error_seed = f"{pdf_path}|{project_id}|{lab_id or 'project'}"
            paper_id = f"paper-error-{hashlib.sha256(error_seed.encode()).hexdigest()[:24]}"
            record = {
                "id": paper_id,
                "projectId": project_id,
                "labId": lab_id,
                "path": str(pdf_path),
                "fileName": pdf_path.name,
                "title": pdf_path.stem,
                "authors": [],
                "doi": None,
                "subject": None,
                "keywords": [],
                "metadataSource": "filename",
                "pdfMetadata": {},
                "sizeBytes": 0,
                "sha256": None,
                "scanStatus": "error",
                "textExtractionStatus": "failed",
                "pageCount": None,
                "textLength": 0,
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
    title = str(record.get("title") or record["fileName"])
    authors = record.get("authors") or []
    keywords = record.get("keywords") or []

    return {
        "id": f"card-{record['id']}",
        "projectId": record.get("projectId", "project-autophagy"),
        "labId": record.get("labId"),
        "title": title,
        "type": card_type,
        "currentRoom": "collection" if failed else "reading",
        "status": "failed" if failed else "queued",
        "progress": 0 if failed else 20,
        "assignedAgent": "collector" if failed else "reader",
        "lastAgent": "collector",
        "lastUpdated": current_clock_time(),
        "requiresUserReview": False,
        "errorMessage": record["errorMessage"],
        "sourcePaperId": record["id"],
        "evidenceCount": 0,
        "approvalStatus": "draft",
        "summary": summary_for_record(record),
        "details": {
            "Title": title,
            "Authors": authors or ["not recorded"],
            "DOI": record.get("doi") or "not detected",
            "Subject": record.get("subject") or "not recorded",
            "Keywords": keywords or ["not recorded"],
            "Pages": record.get("pageCount") or 0,
            "Text characters": record.get("textLength") or 0,
            "File": record["fileName"],
            "Source type": "Local PDF",
            "Source provider": "local_pdf",
            "Metadata source": record.get("metadataSource", "filename"),
            "Path": record["path"],
            "Size bytes": record["sizeBytes"],
            "SHA-256": record["sha256"] or "not available",
            "Scan status": record["scanStatus"],
            "Text extraction": record["textExtractionStatus"],
            "Reader queue": "blocked" if failed else "queued",
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
        return "Local PDF was parsed and queued for Reader with page-level source traces."
    return "Local PDF was scanned and registered."
