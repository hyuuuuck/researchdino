from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from .storage import get_json, put_json


def current_iso_time() -> str:
    return datetime.now().isoformat(timespec="seconds")


def create_research_run(card: dict[str, Any], action: str) -> dict[str, Any]:
    now = current_iso_time()
    record = {
        "id": f"research-run-{uuid4().hex[:12]}",
        "projectId": str(card.get("projectId") or "project-autophagy"),
        "labId": card.get("labId"),
        "sourceCardId": card["id"],
        "action": action,
        "status": "queued",
        "phase": "queued",
        "checkpoint": {},
        "resumeCount": 0,
        "errorMessage": None,
        "startedAt": now,
        "updatedAt": now,
        "completedAt": None,
    }
    put_json("research_runs", record["id"], record)
    return record


def update_research_run(
    run_id: str,
    *,
    status: str | None = None,
    phase: str | None = None,
    checkpoint: dict[str, Any] | None = None,
    error_message: str | None = None,
    completed: bool = False,
    resume_count: int | None = None,
) -> dict[str, Any]:
    record = get_json("research_runs", run_id)
    if record is None:
        raise KeyError(f"Unknown ResearchRun: {run_id}")
    if status is not None:
        record["status"] = status
    if phase is not None:
        record["phase"] = phase
    if checkpoint is not None:
        record["checkpoint"] = {**record.get("checkpoint", {}), **checkpoint}
    if error_message is not None or status in {"running", "completed"}:
        record["errorMessage"] = error_message
    if resume_count is not None:
        record["resumeCount"] = resume_count
    now = current_iso_time()
    record["updatedAt"] = now
    if completed:
        record["completedAt"] = now
    put_json("research_runs", run_id, record)
    return record


def checkpoint_research_run(run_id: str, phase: str, **values: Any) -> dict[str, Any]:
    return update_research_run(run_id, status="running", phase=phase, checkpoint={phase: values})
