from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class MetadataAdapterError(RuntimeError):
    pass


def normalize_doi(value: str) -> str:
    doi = value.strip()
    for prefix in ("https://doi.org/", "http://doi.org/", "doi:"):
        if doi.lower().startswith(prefix):
            doi = doi[len(prefix) :]
    return doi.rstrip(".,;:)").strip()


def _request_json(url: str) -> dict:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "ResearchDino-Lab/0.3 (metadata-only; local research tool)",
        },
    )
    try:
        with urlopen(request, timeout=float(os.getenv("SOURCE_METADATA_TIMEOUT_SECONDS", "15"))) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:300]
        raise MetadataAdapterError(f"Metadata source HTTP {error.code}: {detail}") from error
    except (URLError, TimeoutError) as error:
        raise MetadataAdapterError(f"Metadata source unavailable: {error}") from error
    except json.JSONDecodeError as error:
        raise MetadataAdapterError("Metadata source returned invalid JSON") from error


def _authors(items: list[dict]) -> list[str]:
    values: list[str] = []
    for item in items:
        name = " ".join(
            part.strip()
            for part in (str(item.get("given", "")), str(item.get("family", "")))
            if part.strip()
        )
        if name:
            values.append(name)
    return values


def _openalex_abstract(inverted_index: dict[str, list[int]] | None) -> str:
    if not inverted_index:
        return ""
    words: list[tuple[int, str]] = []
    for word, positions in inverted_index.items():
        words.extend((int(position), word) for position in positions)
    return " ".join(word for _, word in sorted(words))


def fetch_crossref(doi: str) -> dict:
    normalized = normalize_doi(doi)
    if not normalized:
        raise MetadataAdapterError("A DOI is required for Crossref lookup")
    mailto = os.getenv("CROSSREF_MAILTO", "").strip()
    query = f"?mailto={quote(mailto)}" if mailto else ""
    payload = _request_json(f"https://api.crossref.org/works/{quote(normalized, safe='/:._-')}{query}")
    item = payload.get("message", {})
    published = item.get("published-print") or item.get("published-online") or item.get("issued") or {}
    date_parts = published.get("date-parts", [[]])[0]
    return {
        "provider": "crossref",
        "doi": normalized,
        "title": " ".join(str(value) for value in item.get("title", [])).strip(),
        "authors": _authors(item.get("author", [])),
        "journal": " ".join(str(value) for value in item.get("container-title", [])).strip(),
        "publisher": str(item.get("publisher") or ""),
        "year": int(date_parts[0]) if date_parts else None,
        "abstract": str(item.get("abstract") or "").strip(),
        "url": str(item.get("URL") or ""),
        "sourceKind": "metadata_only",
    }


def fetch_openalex(doi: str) -> dict:
    normalized = normalize_doi(doi)
    if not normalized:
        raise MetadataAdapterError("A DOI is required for OpenAlex lookup")
    encoded = quote(f"https://doi.org/{normalized}", safe="")
    item = _request_json(f"https://api.openalex.org/works/{encoded}")
    primary_location = item.get("primary_location") or {}
    source = primary_location.get("source") or {}
    return {
        "provider": "openalex",
        "doi": normalized,
        "title": str(item.get("title") or "").strip(),
        "authors": [
            str((authorship.get("author") or {}).get("display_name") or "").strip()
            for authorship in item.get("authorships", [])
            if (authorship.get("author") or {}).get("display_name")
        ],
        "journal": str(source.get("display_name") or ""),
        "publisher": "",
        "year": item.get("publication_year"),
        "abstract": _openalex_abstract(item.get("abstract_inverted_index")),
        "url": str(item.get("doi") or item.get("id") or ""),
        "sourceKind": "metadata_only",
    }


def lookup_metadata(doi: str, provider: str = "both") -> list[dict]:
    normalized_provider = provider.strip().lower()
    if normalized_provider not in {"crossref", "openalex", "both"}:
        raise MetadataAdapterError("provider must be crossref, openalex, or both")
    providers = [normalized_provider] if normalized_provider != "both" else ["crossref", "openalex"]
    results: list[dict] = []
    errors: list[str] = []
    for selected in providers:
        try:
            results.append(fetch_crossref(doi) if selected == "crossref" else fetch_openalex(doi))
        except MetadataAdapterError as error:
            errors.append(f"{selected}: {error}")
    if not results:
        raise MetadataAdapterError("; ".join(errors) or "No metadata result")
    return results
