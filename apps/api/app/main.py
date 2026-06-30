from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .demo_data import DEMO_ROOMS
from .ingest import is_pymupdf_available, scan_pdf_folder
from .schemas import (
    AgentLogEntry,
    ApiMode,
    IngestFolderRecord,
    IngestFolderRequest,
    IngestScanResult,
    LaboratoryRoom,
    LeaderDecisionRecord,
    LeaderDecisionRequest,
    LibraryEntry,
    PaperFileRecord,
    WorkflowCard,
)
from .storage import DB_PATH, get_json, init_db, list_json, put_json


DEMO_ROOM_MODEL_ASSIGNMENTS = {
    room["id"]: room.get("modelAssignments", [])
    for room in DEMO_ROOMS
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="ResearchDino Lab API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_origin_regex=r"^http://(127\.0\.0\.1|localhost):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def current_clock_time() -> str:
    return datetime.now().strftime("%H:%M")


def current_iso_time() -> str:
    return datetime.now().isoformat(timespec="seconds")


@app.get("/health")
def health() -> dict[str, bool | str]:
    return {"ok": True, "service": "researchdino-api"}


@app.get("/mode", response_model=ApiMode)
def mode() -> ApiMode:
    return ApiMode(mode="api", source="sqlite", databasePath=str(DB_PATH), demoSeed=True)


@app.get("/rooms", response_model=list[LaboratoryRoom])
def rooms() -> list[LaboratoryRoom]:
    hydrated_rooms = []
    for room in list_json("rooms"):
        if not room.get("modelAssignments"):
            room["modelAssignments"] = DEMO_ROOM_MODEL_ASSIGNMENTS.get(room["id"], [])
        hydrated_rooms.append(LaboratoryRoom(**room))
    return hydrated_rooms


@app.get("/cards", response_model=list[WorkflowCard])
def cards() -> list[WorkflowCard]:
    return [WorkflowCard(**card) for card in list_json("cards")]


@app.get("/agent-logs", response_model=list[AgentLogEntry])
def agent_logs() -> list[AgentLogEntry]:
    logs = [AgentLogEntry(**log) for log in list_json("agent_logs")]
    return list(reversed(logs))


@app.get("/leader-decisions", response_model=list[LeaderDecisionRecord])
def leader_decisions() -> list[LeaderDecisionRecord]:
    decisions = [LeaderDecisionRecord(**decision) for decision in list_json("leader_decisions")]
    return list(reversed(decisions))


@app.get("/library", response_model=list[LibraryEntry])
def library() -> list[LibraryEntry]:
    entries = [LibraryEntry(**entry) for entry in list_json("library_entries")]
    return list(reversed(entries))


@app.post("/ingest/folder", response_model=IngestFolderRecord)
def register_ingest_folder(request: IngestFolderRequest) -> IngestFolderRecord:
    folder = Path(request.path).expanduser().resolve(strict=False)
    record = {
        "id": "active",
        "path": str(folder),
        "registeredAt": current_iso_time(),
        "exists": folder.is_dir(),
    }
    put_json("ingest_folders", "active", record)
    return IngestFolderRecord(**record)


@app.get("/ingest/folder", response_model=IngestFolderRecord | None)
def ingest_folder() -> IngestFolderRecord | None:
    record = get_json("ingest_folders", "active")
    if record is None:
        return None
    folder = Path(record["path"])
    record["exists"] = folder.is_dir()
    return IngestFolderRecord(**record)


@app.get("/papers", response_model=list[PaperFileRecord])
def papers() -> list[PaperFileRecord]:
    return [PaperFileRecord(**paper) for paper in list_json("paper_files")]


@app.post("/ingest/scan", response_model=IngestScanResult)
def scan_ingest_folder() -> IngestScanResult:
    record = get_json("ingest_folders", "active")
    if record is None:
        raise HTTPException(status_code=400, detail="No ingest folder is registered")

    folder = Path(record["path"])
    if not folder.is_dir():
        raise HTTPException(status_code=400, detail="Registered ingest folder does not exist")

    paper_records, card_records, text_records = scan_pdf_folder(folder)

    for paper in paper_records:
        put_json("paper_files", paper["id"], paper)
    for card in card_records:
        put_json("cards", card["id"], card)
    for text in text_records:
        put_json("paper_texts", text["id"], text)

    error_messages = [
        f"{paper['fileName']}: {paper['errorMessage']}"
        for paper in paper_records
        if paper.get("errorMessage")
    ]
    paper_card_count = sum(1 for card in card_records if card["type"] == "paper")
    error_card_count = sum(1 for card in card_records if card["type"] == "error")

    log_id = f"log-{uuid4().hex[:12]}"
    put_json(
        "agent_logs",
        log_id,
        {
            "id": log_id,
            "time": current_clock_time(),
            "agent": "collector",
            "room": "collection",
            "level": "warning" if error_messages else "info",
            "title": "PDF folder scanned",
            "message": f"{len(paper_records)} PDF files scanned from {folder}.",
            "relatedCardId": card_records[0]["id"] if card_records else None,
        },
    )

    return IngestScanResult(
        folderPath=str(folder),
        pdfCount=len(paper_records),
        paperCardCount=paper_card_count,
        errorCardCount=error_card_count,
        parserAvailable=is_pymupdf_available(),
        errors=error_messages,
    )


@app.post("/leader-decisions", response_model=LeaderDecisionRecord)
def create_leader_decision(request: LeaderDecisionRequest) -> LeaderDecisionRecord:
    card = get_json("cards", request.cardId)
    if card is None:
        raise HTTPException(status_code=404, detail="Workflow card not found")

    next_status = {
        "approved": "approved",
        "rejected": "rejected",
        "needs_revision": "waiting_for_user",
        "stored_in_library": "stored_in_library",
    }[request.decision]

    decision_id = f"decision-{uuid4().hex[:12]}"
    created_at = current_iso_time()
    record = {
        "id": decision_id,
        "cardId": request.cardId,
        "decision": request.decision,
        "reason": request.reason.strip(),
        "createdAt": created_at,
        "resultingStatus": next_status,
    }

    card["status"] = next_status
    card["approvalStatus"] = request.decision
    card["requiresUserReview"] = request.decision == "needs_revision"
    card["lastAgent"] = "leader"
    card["lastUpdated"] = current_clock_time()
    if request.decision == "stored_in_library":
        card["currentRoom"] = "library"
        card["progress"] = 100

    put_json("cards", card["id"], card)
    put_json("leader_decisions", decision_id, record)

    log_id = f"log-{uuid4().hex[:12]}"
    put_json(
        "agent_logs",
        log_id,
        {
            "id": log_id,
            "time": current_clock_time(),
            "agent": "leader",
            "room": "leader",
            "level": "approval",
            "title": f"Leader decision: {request.decision.replace('_', ' ')}",
            "message": request.reason.strip() or "Decision recorded without an additional note.",
            "relatedCardId": request.cardId,
        },
    )

    if request.decision == "stored_in_library":
        entry_id = f"library-{uuid4().hex[:12]}"
        put_json(
            "library_entries",
            entry_id,
            {
                "id": entry_id,
                "title": card["title"],
                "summary": card["summary"],
                "sourceCardId": card["id"],
                "decisionId": decision_id,
                "evidenceCount": card["evidenceCount"],
                "storedAt": created_at,
            },
        )

    return LeaderDecisionRecord(**record)
