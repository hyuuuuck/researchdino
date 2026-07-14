from __future__ import annotations

import re
from typing import Any


def _base_locator(paper_id: str, paragraph_index: int) -> dict[str, Any]:
    return {
        "paperId": paper_id,
        "pageNumber": None,
        "sectionId": None,
        "paragraphIndex": paragraph_index,
        "charStart": None,
        "charEnd": None,
        "verified": False,
        "matchType": "not_found",
    }


def _find_excerpt(page_text: str, excerpt: str) -> tuple[int, int, str] | None:
    candidate = excerpt.strip()
    if not candidate:
        return None

    exact_start = page_text.find(candidate)
    if exact_start >= 0:
        return exact_start, exact_start + len(candidate), "exact"

    tokens = candidate.split()
    if not tokens:
        return None
    token_pattern = r"\s+".join(re.escape(token) for token in tokens)
    match = re.search(token_pattern, page_text)
    if match:
        return match.start(), match.end(), "whitespace_normalized"
    return None


def verify_evidence_excerpt(
    text_record: dict[str, Any] | None,
    paper_id: str,
    excerpt: str,
    paragraph_index: int,
) -> dict[str, Any]:
    """Verify that a Reader excerpt exists in the parsed PDF text.

    A paraphrase is deliberately not accepted as verified evidence. The model
    may interpret a span, but only text that can be located in the source can
    support a claim without an explicit human review.
    """

    locator = _base_locator(paper_id, paragraph_index)
    if not text_record or not str(text_record.get("text", "")).strip():
        return {
            "status": "unverified",
            "reason": "parsed source text is unavailable",
            "matchedText": None,
            "locator": locator,
        }

    for page in text_record.get("pages", []):
        page_text = str(page.get("text", ""))
        match = _find_excerpt(page_text, excerpt)
        if match is None:
            continue
        local_start, local_end, match_type = match
        page_number = int(page.get("pageNumber", 0)) or None
        page_start = int(page.get("charStart", 0))
        matched_text = page_text[local_start:local_end]
        verified_locator = {
            **locator,
            "pageNumber": page_number,
            "sectionId": f"page-{page_number}" if page_number else None,
            "charStart": page_start + local_start,
            "charEnd": page_start + local_end,
            "verified": True,
            "matchType": match_type,
        }
        return {
            "status": "verified",
            "reason": "excerpt located in parsed PDF text",
            "matchedText": matched_text,
            "locator": verified_locator,
        }

    return {
        "status": "unverified",
        "reason": "excerpt was not found in parsed PDF text; treat it as a model paraphrase",
        "matchedText": None,
        "locator": locator,
    }
