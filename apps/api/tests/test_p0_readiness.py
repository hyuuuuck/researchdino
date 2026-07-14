from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.evidence_verifier import verify_evidence_excerpt  # noqa: E402
from app.source_adapters import fetch_crossref, fetch_openalex, normalize_doi  # noqa: E402


class FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.payload = json.dumps(payload).encode("utf-8")

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return self.payload


class P0ReadinessTests(unittest.TestCase):
    def test_evidence_verifier_requires_verbatim_source_span(self) -> None:
        text_record = {
            "text": "A delayed response was observed.",
            "pages": [{"pageNumber": 2, "text": "A delayed\nresponse was observed.", "charStart": 0, "charEnd": 32}],
        }
        verified = verify_evidence_excerpt(text_record, "paper-1", "A delayed response was observed.", 1)
        unverified = verify_evidence_excerpt(text_record, "paper-1", "The response is caused by pathway X.", 2)

        self.assertEqual(verified["status"], "verified")
        self.assertEqual(verified["locator"]["pageNumber"], 2)
        self.assertEqual(verified["locator"]["matchType"], "whitespace_normalized")
        self.assertEqual(unverified["status"], "unverified")
        self.assertIsNone(unverified["locator"]["charStart"])

    def test_crossref_and_openalex_adapters_normalize_metadata(self) -> None:
        self.assertEqual(normalize_doi("https://doi.org/10.1000/example."), "10.1000/example")
        crossref_payload = {
            "message": {
                "title": ["A paper"],
                "author": [{"given": "Ada", "family": "Lovelace"}],
                "container-title": ["Research Journal"],
                "publisher": "Example Press",
                "published-print": {"date-parts": [[2026, 1, 1]]},
                "DOI": "10.1000/example",
                "URL": "https://doi.org/10.1000/example",
            }
        }
        openalex_payload = {
            "title": "A paper",
            "publication_year": 2026,
            "doi": "https://doi.org/10.1000/example",
            "authorships": [{"author": {"display_name": "Ada Lovelace"}}],
            "primary_location": {"source": {"display_name": "Research Journal"}},
            "abstract_inverted_index": {"A": [0], "paper": [1]},
        }

        with patch("app.source_adapters.urlopen", side_effect=[FakeResponse(crossref_payload), FakeResponse(openalex_payload)]):
            crossref = fetch_crossref("10.1000/example")
            openalex = fetch_openalex("10.1000/example")

        self.assertEqual(crossref["authors"], ["Ada Lovelace"])
        self.assertEqual(openalex["abstract"], "A paper")
        self.assertEqual(crossref["sourceKind"], "metadata_only")
        self.assertEqual(openalex["sourceKind"], "metadata_only")


if __name__ == "__main__":
    unittest.main()
