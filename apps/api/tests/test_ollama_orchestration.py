from __future__ import annotations

import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from typing import Any


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app import storage  # noqa: E402
from app.model_registry import model_for_role  # noqa: E402
from app.ollama_runtime import (  # noqa: E402
    OllamaCallResult,
    OllamaRuntimeError,
    run_debate_deputies,
    run_reader_deputy,
)


class FakeOllamaClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []
        self.lock = threading.Lock()
        self.outputs: dict[str, dict[str, Any]] = {
            "reader": {
                "summary": "A source-grounded reader summary.",
                "abstract": "The study evaluates a timing-dependent mechanism.",
                "methods": ["Time-course assay"],
                "results": ["Delayed activation was observed."],
                "limitations": ["Long-duration replication is missing."],
                "claims": ["Delayed activation depends on stress timing."],
                "evidence": [
                    {
                        "excerpt": "Delayed activation depends on stress timing.",
                        "interpretation": "Direct support for a timing effect.",
                        "strength": "moderate",
                    }
                ],
            },
            "critic": {
                "objections": ["The replicate count is not reported."],
                "opposing_evidence": ["A control condition remains ambiguous."],
                "unresolved_questions": ["Does the effect replicate independently?"],
                "verdict": "Promising but under-controlled.",
            },
            "librarian": {
                "verified_evidence": ["Delayed activation was observed in the source text."],
                "traceability_issues": ["Figure locator is missing."],
                "storage_recommendation": "Block storage until the figure is linked.",
            },
            "strategist": {
                "research_gaps": ["Independent replication across stress windows is missing."],
                "hypotheses": ["A delayed adaptive window mediates the response."],
                "research_strategy": ["Compare early and delayed stress windows."],
            },
            "experiment": {
                "suggested_experiments": ["Run a controlled time-course with orthogonal readouts."],
                "experiment_strategy": ["Use vehicle, unstressed, and positive controls."],
                "feasibility_risks": ["Signal saturation may hide the timing effect."],
            },
            "coordinator": {
                "conclusion": "The claim remains provisional pending controlled replication.",
                "meeting_summary": "Deputies agreed on a testable timing hypothesis and unresolved controls.",
                "decision_criteria": ["Require independent replication and a figure locator."],
                "leader_recommendation": "Request more evidence.",
            },
            "leader": {
                "recommendation": "needs_more_evidence",
                "rationale": "The claim lacks independent replication.",
                "blocking_issues": ["Missing replicate count"],
            },
        }

    def chat_json(self, role: str, messages: list[dict[str, str]]) -> OllamaCallResult:
        prompt = messages[-1]["content"]
        with self.lock:
            self.calls.append((role, prompt))
        return OllamaCallResult(
            model=model_for_role(role),
            content=self.outputs[role],
            metrics={"evalCount": 42},
        )


class FailingOllamaClient:
    def chat_json(self, role: str, messages: list[dict[str, str]]) -> OllamaCallResult:
        raise OllamaRuntimeError("Ollama HTTP 429: weekly usage limit reached")


class OllamaOrchestrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_db_path = storage.DB_PATH
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        storage.DB_PATH = self.root / "researchdino-ollama-test.sqlite3"
        storage.init_db()
        self.card = {
            "id": "debate-test",
            "projectId": "project-test",
            "labId": "lab-alpha",
            "title": "Timing-dependent activation",
            "details": {"source_paper": "test-paper.pdf"},
        }

    def tearDown(self) -> None:
        storage.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_reader_persists_real_model_run_and_message(self) -> None:
        client = FakeOllamaClient()
        output = run_reader_deputy(
            self.card,
            {"text": "Delayed activation depends on stress timing.", "pages": []},
            client,
        )

        self.assertEqual(output["claims"][0], "Delayed activation depends on stress timing.")
        runs = storage.list_json("agent_runs")
        messages = storage.list_json("agent_messages")
        self.assertEqual([(run["agent"], run["status"]) for run in runs], [("reader", "completed")])
        self.assertEqual(messages[0]["content"]["summary"], "A source-grounded reader summary.")

    def test_debate_fans_out_exchanges_results_and_fans_in(self) -> None:
        client = FakeOllamaClient()
        result = run_debate_deputies(
            self.card,
            "Delayed activation depends on stress timing.",
            ["Delayed activation was observed in the source text."],
            ["Long-duration replication is missing."],
            client,
        )

        self.assertEqual(result["leader"]["recommendation"], "needs_more_evidence")
        calls = {role: json.loads(prompt) for role, prompt in client.calls}
        self.assertIn("critic", calls["strategist"])
        self.assertIn("librarian", calls["experiment"])
        self.assertIn("strategist", calls["coordinator"])
        self.assertIn("coordinator", calls["leader"]["packet"])

        runs = storage.list_json("agent_runs")
        messages = storage.list_json("agent_messages")
        self.assertEqual({run["agent"] for run in runs}, {"critic", "librarian", "strategist", "experiment", "coordinator", "leader"})
        self.assertTrue(all(run["status"] == "completed" for run in runs))
        self.assertEqual(len(messages), 6)

    def test_provider_failure_is_persisted_without_template_fallback(self) -> None:
        with self.assertRaises(OllamaRuntimeError):
            run_reader_deputy(
                self.card,
                {"text": "Delayed activation depends on stress timing.", "pages": []},
                FailingOllamaClient(),
            )

        runs = storage.list_json("agent_runs")
        self.assertEqual(runs[0]["status"], "failed")
        self.assertIn("weekly usage limit", runs[0]["errorMessage"])
        self.assertEqual(storage.list_json("agent_messages"), [])


if __name__ == "__main__":
    unittest.main()
