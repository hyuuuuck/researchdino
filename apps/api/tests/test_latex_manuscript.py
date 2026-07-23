from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app import storage  # noqa: E402
from app.agent_pipeline import PipelineError, draft_manuscript  # noqa: E402
from app.manuscript import (  # noqa: E402
    ManuscriptError,
    build_manuscript_document,
    create_manuscript_document,
    manuscript_pdf_path,
    normalized_sections,
    update_manuscript_document,
)


class LatexManuscriptTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_db_path = storage.DB_PATH
        self.original_runtime = os.environ.get("RESEARCHDINO_AGENT_RUNTIME")
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        storage.DB_PATH = self.root / "researchdino-latex-test.sqlite3"
        os.environ["RESEARCHDINO_AGENT_RUNTIME"] = "deterministic"
        storage.init_db()
        storage.put_json(
            "cards",
            "approved-card",
            {
                "id": "approved-card",
                "projectId": "project-test",
                "labId": "lab-test",
                "title": "Approved thermal timing claim",
                "type": "claim",
                "currentRoom": "library",
                "status": "stored_in_library",
                "progress": 100,
                "assignedAgent": "librarian",
                "lastAgent": "leader",
                "lastUpdated": "12:00",
                "requiresUserReview": False,
                "sourcePaperId": "paper-test",
                "evidenceCount": 1,
                "approvalStatus": "stored_in_library",
                "summary": "Delayed activation was observed in the approved experiment.",
                "details": {},
            },
        )
        storage.put_json(
            "library_entries",
            "library-approved",
            {
                "id": "library-approved",
                "projectId": "project-test",
                "labId": "lab-test",
                "title": "Timing-dependent activation",
                "summary": "Leader-approved evidence.",
                "sourceCardId": "approved-card",
                "decisionId": "decision-test",
                "evidenceCount": 1,
                "storedAt": "2026-07-23T12:00:00",
            },
        )
        storage.put_json(
            "paper_files",
            "paper-test",
            {
                "id": "paper-test",
                "authors": ["Dino Researcher", "Lab Scientist"],
                "doi": "10.1000/researchdino",
                "fileName": "timing.pdf",
            },
        )

    def tearDown(self) -> None:
        storage.DB_PATH = self.original_db_path
        if self.original_runtime is None:
            os.environ.pop("RESEARCHDINO_AGENT_RUNTIME", None)
        else:
            os.environ["RESEARCHDINO_AGENT_RUNTIME"] = self.original_runtime
        self.temp_dir.cleanup()

    def test_writer_action_creates_latex_and_bib_from_library_only(self) -> None:
        with patch("app.manuscript.detect_compiler", return_value=(None, None)):
            result = draft_manuscript("approved-card")

        manuscript_id = result["createdCardIds"][0]
        document = storage.get_json("manuscript_documents", manuscript_id)
        self.assertIsNotNone(document)
        self.assertIn("\\documentclass[11pt]{article}", document["sourceTex"])
        self.assertIn("\\bibliography{references}", document["sourceTex"])
        self.assertIn("@misc{", document["bibliographyBib"])
        self.assertIn("10.1000/researchdino", document["bibliographyBib"])
        self.assertEqual(document["libraryEntryIds"], ["library-approved"])
        self.assertEqual(document["build"]["status"], "compiler_unavailable")

        artifact_dir = self.root / "manuscripts" / manuscript_id
        self.assertTrue((artifact_dir / "main.tex").is_file())
        self.assertTrue((artifact_dir / "references.bib").is_file())

    def test_writer_rejects_card_that_has_not_entered_library(self) -> None:
        card = storage.get_json("cards", "approved-card")
        card["status"] = "approved"
        card["currentRoom"] = "leader"
        storage.put_json("cards", card["id"], card)

        with self.assertRaisesRegex(PipelineError, "stored in Library"):
            draft_manuscript(card["id"])

    def test_source_update_rejects_file_read_commands(self) -> None:
        manuscript_card = {
            "id": "manuscript-approved-card",
            "projectId": "project-test",
            "labId": "lab-test",
            "title": "Safe manuscript",
        }
        source_card = storage.get_json("cards", "approved-card")
        create_manuscript_document(manuscript_card, source_card, None)

        unsafe_source = (
            "\\documentclass{article}\n"
            "\\begin{document}\n"
            "\\input{/etc/passwd}\n"
            "\\end{document}\n"
        )
        with self.assertRaisesRegex(ManuscriptError, "Unsafe LaTeX command"):
            update_manuscript_document("manuscript-approved-card", source_tex=unsafe_source)

    def test_model_paragraph_is_not_marked_supported_by_citation_key_alone(self) -> None:
        source_card = storage.get_json("cards", "approved-card")
        sections = normalized_sections(
            source_card,
            {
                "sections": [
                    {
                        "heading": "Results",
                        "paragraphs": ["An unsupported effect size was invented."],
                        "citation_keys": ["approvedkey"],
                        "support_status": "evidence_linked",
                    }
                ]
            },
            ["approvedkey"],
        )

        self.assertEqual(sections[0]["citationKeys"], ["approvedkey"])
        self.assertEqual(sections[0]["supportStatus"], "needs_user_review")

    def test_local_build_records_pdf_artifact_without_shell(self) -> None:
        manuscript_card = {
            "id": "manuscript-approved-card",
            "projectId": "project-test",
            "labId": "lab-test",
            "title": "Buildable manuscript",
        }
        source_card = storage.get_json("cards", "approved-card")
        create_manuscript_document(manuscript_card, source_card, None)
        fake_compiler = [
            sys.executable,
            "-c",
            "from pathlib import Path; Path('build/main.pdf').write_bytes(b'%PDF-1.4\\n%%EOF\\n')",
        ]

        with patch("app.manuscript.detect_compiler", return_value=("fake-tectonic", fake_compiler)):
            built = build_manuscript_document("manuscript-approved-card")

        self.assertEqual(built["build"]["status"], "compiled")
        self.assertTrue(built["build"]["pdfAvailable"])
        self.assertTrue(manuscript_pdf_path("manuscript-approved-card").is_file())


if __name__ == "__main__":
    unittest.main()
