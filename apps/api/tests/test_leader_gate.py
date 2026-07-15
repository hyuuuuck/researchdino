import sys
import tempfile
import unittest
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from fastapi import HTTPException  # noqa: E402

from app import storage  # noqa: E402
from app.main import create_leader_decision  # noqa: E402
from app.schemas import LeaderDecisionRequest  # noqa: E402


class LeaderGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_db_path = storage.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        storage.DB_PATH = Path(self.temp_dir.name) / "researchdino-leader-test.sqlite3"
        storage.init_db()
        storage.put_json(
            "cards",
            "debate-card",
            {
                "id": "debate-card",
                "projectId": "project-autophagy",
                "labId": "lab-alpha",
                "title": "Claim under review",
                "status": "waiting_for_leader_review",
                "currentRoom": "leader",
                "progress": 88,
                "requiresUserReview": True,
                "evidenceCount": 1,
                "approvalStatus": "pending_review",
                "summary": "Review packet",
                "details": {"Unverified evidence": ["Model paraphrase not found in source"]},
                "assignedAgent": "leader",
                "lastAgent": "coordinator",
                "lastUpdated": "12:00",
            },
        )

    def tearDown(self) -> None:
        storage.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_unverified_evidence_blocks_library_storage(self) -> None:
        with self.assertRaisesRegex(HTTPException, "Unverified evidence"):
            create_leader_decision(
                LeaderDecisionRequest(
                    cardId="debate-card",
                    decision="stored_in_library",
                    reason="Attempted storage",
                )
            )
        self.assertEqual(storage.list_json("library_entries"), [])

    def test_revision_request_is_recorded_without_library_storage(self) -> None:
        record = create_leader_decision(
            LeaderDecisionRequest(
                cardId="debate-card",
                decision="needs_revision",
                reason="Request source verification",
            )
        )
        self.assertEqual(record.resultingStatus, "waiting_for_user")
        self.assertEqual(storage.list_json("library_entries"), [])


if __name__ == "__main__":
    unittest.main()
