import sys
import tempfile
import unittest
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app import storage  # noqa: E402
from app.agent_pipeline import PipelineError, ensure_lab_can_run  # noqa: E402


class ScopeControlTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_db_path = storage.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        storage.DB_PATH = Path(self.temp_dir.name) / "researchdino-scope-test.sqlite3"
        storage.init_db()
        storage.put_json(
            "projects",
            "project-materials",
            {"id": "project-materials", "status": "active"},
        )
        storage.put_json(
            "lab_instances",
            "lab-a",
            {"id": "lab-a", "projectId": "project-materials", "enabled": True, "status": "running"},
        )
        storage.put_json(
            "lab_instances",
            "lab-b",
            {"id": "lab-b", "projectId": "project-materials", "enabled": True, "status": "running"},
        )

    def tearDown(self) -> None:
        storage.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_pausing_one_lab_blocks_only_that_lab(self) -> None:
        card_a = {"id": "card-a", "projectId": "project-materials", "labId": "lab-a"}
        card_b = {"id": "card-b", "projectId": "project-materials", "labId": "lab-b"}

        ensure_lab_can_run(card_a)
        ensure_lab_can_run(card_b)

        storage.put_json("lab_instances", "lab-a", {"id": "lab-a", "projectId": "project-materials", "enabled": True, "status": "paused"})

        with self.assertRaisesRegex(PipelineError, "Lab lab-a is paused"):
            ensure_lab_can_run(card_a)
        ensure_lab_can_run(card_b)

    def test_paused_project_blocks_all_project_labs(self) -> None:
        storage.put_json("projects", "project-materials", {"id": "project-materials", "status": "paused"})

        with self.assertRaisesRegex(PipelineError, "Project project-materials is paused"):
            ensure_lab_can_run({"id": "card-a", "projectId": "project-materials", "labId": "lab-a"})


if __name__ == "__main__":
    unittest.main()
