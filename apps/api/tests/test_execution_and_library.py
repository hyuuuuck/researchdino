import sys
import tempfile
import unittest
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app import storage  # noqa: E402
from app.agent_pipeline import PipelineError, ensure_lab_can_run  # noqa: E402
from app.main import patch_lab_instance, search_library  # noqa: E402
from app.schemas import LabInstancePatchRequest  # noqa: E402


class ExecutionAndLibraryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_db_path = storage.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        storage.DB_PATH = Path(self.temp_dir.name) / "researchdino-controls-test.sqlite3"
        storage.init_db()
        storage.put_json(
            "projects",
            "project-materials",
            {"id": "project-materials", "status": "active"},
        )
        storage.put_json(
            "lab_instances",
            "lab-a",
            {
                "id": "lab-a",
                "name": "Lab A",
                "label": "Test Lab",
                "projectId": "project-materials",
                "mode": "full",
                "status": "running",
                "summary": "Test",
                "enabled": True,
                "createdAt": "2026-07-15",
                "maxParallelTasks": 1,
                "model": "qwen3.5:latest",
                "approvalMode": "assisted",
            },
        )

    def tearDown(self) -> None:
        storage.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_lab_concurrency_limit_is_enforced_per_lab(self) -> None:
        storage.put_json(
            "research_runs",
            "run-a",
            {"id": "run-a", "labId": "lab-a", "status": "running"},
        )

        with self.assertRaisesRegex(PipelineError, "concurrency limit \(1\)"):
            ensure_lab_can_run({"id": "card-a", "projectId": "project-materials", "labId": "lab-a"})

        ensure_lab_can_run(
            {"id": "card-a", "projectId": "project-materials", "labId": "lab-a"},
            run_id="run-a",
        )

    def test_lab_execution_settings_are_persisted_and_local_only(self) -> None:
        updated = patch_lab_instance(
            "lab-a",
            LabInstancePatchRequest(maxParallelTasks=4, model="qwen3.5:latest", approvalMode="manual"),
        )
        self.assertEqual(updated.maxParallelTasks, 4)
        self.assertEqual(updated.approvalMode, "manual")
        self.assertEqual(storage.get_json("lab_instances", "lab-a")["model"], "qwen3.5:latest")

        with self.assertRaisesRegex(Exception, "local Ollama"):
            patch_lab_instance("lab-a", LabInstancePatchRequest(model="https://cloud.example/model"))

    def test_library_search_uses_fts_and_returns_source_locator(self) -> None:
        storage.put_json(
            "library_entries",
            "library-test",
            {
                "id": "library-test",
                "projectId": "project-materials",
                "labId": "lab-a",
                "title": "Stacked laminate thermal interface",
                "summary": "Approved evidence for layered materials.",
                "sourceCardId": "card-test",
                "decisionId": "decision-test",
                "evidenceCount": 1,
                "storedAt": "2026-07-15T12:00:00",
            },
        )
        storage.put_json(
            "evidence_items",
            "evidence-test",
            {
                "id": "evidence-test",
                "projectId": "project-materials",
                "labId": "lab-a",
                "sourceCardId": "card-test",
                "excerpt": "Thermal interface resistance decreased after stacking.",
                "locator": {"pageNumber": 4, "charStart": 120, "charEnd": 188},
            },
        )

        results = search_library(q="thermal interface", projectId="project-materials", labId="lab-a")
        self.assertEqual([entry.id for entry in results], ["library-test"])
        self.assertEqual(results[0].sourceLocators[0]["pageNumber"], 4)


if __name__ == "__main__":
    unittest.main()
