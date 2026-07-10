from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import pymupdf


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app import storage  # noqa: E402
from app.agent_pipeline import run_agent_action  # noqa: E402
from app.main import paper_text, register_ingest_folder, scan_ingest_folder  # noqa: E402
from app.schemas import IngestFolderRequest  # noqa: E402


class LocalPdfIngestTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_db_path = storage.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.pdf_path = self.root / "layered-materials-study.pdf"
        self.create_pdf(self.pdf_path)
        storage.DB_PATH = self.root / "researchdino-test.sqlite3"
        storage.init_db()

    def tearDown(self) -> None:
        storage.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    @staticmethod
    def create_pdf(path: Path) -> None:
        document = pymupdf.open()
        page = document.new_page(width=612, height=792)
        page.insert_text((72, 90), "Layered Materials Stress Timing Study", fontsize=18)
        page.insert_text((72, 125), "Alice Example and Bob Example", fontsize=11)
        page.insert_text((72, 160), "DOI: 10.1234/researchdino.2026.001", fontsize=10)
        page.insert_textbox(
            pymupdf.Rect(72, 200, 540, 430),
            "A delayed induction window improves interlayer bonding under cyclic thermal stress "
            "and remains measurable across independent replicates. The control condition did not "
            "show the same response, supporting a timing-dependent mechanism.",
            fontsize=11,
        )
        page = document.new_page(width=612, height=792)
        page.insert_text((72, 90), "Methods and limitations", fontsize=16)
        page.insert_textbox(
            pymupdf.Rect(72, 130, 540, 430),
            "Samples were measured with vehicle and unstressed controls. A limitation is that "
            "long-duration orbital exposure was not reproduced in this first experiment.",
            fontsize=11,
        )
        document.set_metadata(
            {
                "title": "Layered Materials Stress Timing Study",
                "author": "Alice Example; Bob Example",
                "subject": "Research article DOI 10.1234/researchdino.2026.001",
                "keywords": "layered materials; thermal stress; bonding",
            }
        )
        document.save(path)
        document.close()

    def register(self, lab_id: str) -> None:
        register_ingest_folder(
            IngestFolderRequest(
                path=str(self.root),
                projectId="project-layered-materials",
                labId=lab_id,
            )
        )

    def paper_for_lab(self, lab_id: str) -> dict:
        return next(
            paper
            for paper in storage.list_json("paper_files")
            if paper.get("path") == str(self.pdf_path) and paper.get("labId") == lab_id
        )

    def test_scan_parses_deduplicates_and_queues_reader(self) -> None:
        self.register("lab-beta")
        first = scan_ingest_folder()
        second = scan_ingest_folder()

        self.assertEqual((first.newPaperCount, first.parsedPaperCount, first.readerQueueCount), (1, 1, 1))
        self.assertEqual((second.newPaperCount, second.duplicatePaperCount), (0, 1))

        paper = self.paper_for_lab("lab-beta")
        self.assertEqual(paper["title"], "Layered Materials Stress Timing Study")
        self.assertEqual(paper["authors"], ["Alice Example", "Bob Example"])
        self.assertEqual(paper["doi"], "10.1234/researchdino.2026.001")
        self.assertEqual(len(paper_text(paper["id"]).pages), 2)

        result = run_agent_action(f"card-{paper['id']}", "run_reader")
        self.assertEqual(len(result["createdCardIds"]), 1)
        evidence = [
            item
            for item in storage.list_json("evidence_items")
            if item.get("paperId") == paper["id"]
        ]
        self.assertEqual([item["locator"]["pageNumber"] for item in evidence], [1, 1, 2])

    def test_same_pdf_is_isolated_between_labs(self) -> None:
        self.register("lab-beta")
        beta = scan_ingest_folder()
        beta_paper = self.paper_for_lab("lab-beta")

        self.register("lab-gamma")
        gamma = scan_ingest_folder()
        gamma_paper = self.paper_for_lab("lab-gamma")

        self.assertEqual(beta.newPaperCount, 1)
        self.assertEqual(gamma.newPaperCount, 1)
        self.assertNotEqual(beta_paper["id"], gamma_paper["id"])


if __name__ == "__main__":
    unittest.main()
