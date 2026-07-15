from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .agent_pipeline import PipelineError, run_agent_action
from .demo_data import DEMO_ROOMS
from .ingest import is_pymupdf_available, scan_pdf_folder
from .ollama_runtime import OllamaClient
from .run_tracker import create_research_run
from .source_adapters import MetadataAdapterError, lookup_metadata, normalize_doi
from .schemas import (
    AgentActionRequest,
    AgentActionResult,
    AgentLogEntry,
    AgentMessageRecord,
    AgentRunRecord,
    ApiMode,
    DebateSessionRecord,
    EvidenceRecord,
    ExperimentPlanRecord,
    HypothesisRecord,
    IngestFolderRecord,
    IngestFolderRequest,
    IngestScanResult,
    LabInstance,
    LabInstancePatchRequest,
    LaboratoryRoom,
    LeaderDecisionRecord,
    LeaderDecisionRequest,
    LibraryEntry,
    ModelRuntimeStatus,
    MetadataCandidate,
    MetadataLookupResponse,
    PaperFileRecord,
    PaperTextRecord,
    ResearchClaim,
    ResearchProject,
    ResearchProjectCreateRequest,
    ResearchProjectPatchRequest,
    ResearchRunRecord,
    WorkflowCard,
    WorkflowCardCreateRequest,
    WorkflowCardPatchRequest,
)
from .storage import DB_PATH, delete_json, get_json, init_db, list_json, put_json


DEMO_ROOM_MODEL_ASSIGNMENTS = {
    room["id"]: room.get("modelAssignments", [])
    for room in DEMO_ROOMS
}

DEMO_ROOM_SOURCE_CONNECTORS = {
    room["id"]: room.get("sourceConnectors", [])
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


def require_project(project_id: str) -> dict:
    project = get_json("projects", project_id)
    if project is None:
        raise HTTPException(status_code=400, detail=f"Project {project_id} was not found")
    return project


def resolve_lab_id(project_id: str, lab_id: str | None) -> str:
    require_project(project_id)
    labs = list_json("lab_instances")
    if lab_id:
        lab = next((item for item in labs if item.get("id") == lab_id), None)
        if lab is None:
            raise HTTPException(status_code=400, detail=f"Lab {lab_id} was not found")
        if lab.get("projectId") != project_id:
            raise HTTPException(status_code=400, detail=f"Lab {lab_id} is assigned to another project")
        return lab_id

    candidate = next(
        (
            item
            for item in labs
            if item.get("projectId") == project_id and item.get("enabled") and item.get("status") != "paused"
        ),
        None,
    )
    if candidate is None:
        raise HTTPException(status_code=400, detail=f"Project {project_id} has no active Lab; assign one before creating research data")
    return str(candidate["id"])


def ingest_scope_key(project_id: str, lab_id: str) -> str:
    return f"{project_id}:{lab_id}"


def latest_ingest_record(project_id: str, lab_id: str) -> dict | None:
    scoped = [
        record
        for record in list_json("ingest_folders")
        if record.get("projectId") == project_id and record.get("labId") == lab_id
    ]
    return scoped[-1] if scoped else get_json("ingest_folders", ingest_scope_key(project_id, lab_id))


def card_has_unverified_evidence(card: dict) -> bool:
    detail_unverified = card.get("details", {}).get("Unverified evidence", [])
    if detail_unverified:
        return True
    claim_id = card.get("details", {}).get("Claim record")
    evidence_records = list_json("evidence_items")
    return any(
        record.get("verificationStatus") != "verified"
        and (
            record.get("sourceCardId") == card.get("id")
            or (claim_id and record.get("claimId") == claim_id)
        )
        for record in evidence_records
    )


ROOM_AGENT_MAP = {
    "coordinator": "coordinator",
    "collection": "search",
    "reading": "reader",
    "debate": "critic",
    "leader": "leader",
    "library": "librarian",
    "strategy": "strategist",
    "experiment": "experiment",
    "writing": "writer",
}


STATUS_PROGRESS_MAP = {
    "idle": 12,
    "waiting_for_claim": 18,
    "queued": 18,
    "running": 48,
    "debating": 62,
    "waiting_for_user": 82,
    "waiting_for_leader_review": 82,
    "needs_more_evidence": 70,
    "approved": 100,
    "stored_in_library": 100,
    "archived": 100,
    "rejected": 100,
    "failed": 100,
}


STATUS_APPROVAL_MAP = {
    "approved": "approved",
    "stored_in_library": "stored_in_library",
    "rejected": "rejected",
    "waiting_for_user": "pending_review",
    "waiting_for_leader_review": "pending_review",
    "needs_more_evidence": "needs_revision",
}


def create_card_log(card: dict, level: str, title: str, message: str) -> None:
    log_id = f"log-{uuid4().hex[:12]}"
    put_json(
        "agent_logs",
        log_id,
        {
            "id": log_id,
            "projectId": card.get("projectId", "project-autophagy"),
            "labId": card.get("labId"),
            "time": current_clock_time(),
            "agent": card.get("lastAgent", card.get("assignedAgent", "coordinator")),
            "room": card.get("currentRoom", "coordinator"),
            "level": level,
            "title": title,
            "message": message,
            "relatedCardId": card["id"],
        },
    )


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
        room["modelAssignments"] = DEMO_ROOM_MODEL_ASSIGNMENTS.get(room["id"], room.get("modelAssignments", []))
        if not room.get("sourceConnectors"):
            room["sourceConnectors"] = DEMO_ROOM_SOURCE_CONNECTORS.get(room["id"], [])
        hydrated_rooms.append(LaboratoryRoom(**room))
    return hydrated_rooms


@app.get("/projects", response_model=list[ResearchProject])
def projects() -> list[ResearchProject]:
    return [ResearchProject(**project) for project in list_json("projects")]


@app.post("/projects", response_model=ResearchProject)
def create_project(request: ResearchProjectCreateRequest) -> ResearchProject:
    title = request.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Project title is required")

    project_id = f"project-{uuid4().hex[:12]}"
    project = {
        "id": project_id,
        "title": title,
        "shortTitle": request.shortTitle.strip() or title,
        "domain": request.domain.strip() or "Research",
        "description": request.description.strip() or f"Research workspace for {title}.",
        "status": request.status,
        "sourceNote": request.sourceNote.strip() or "Source pending",
        "lead": request.lead.strip() or "ResearchDino Lab",
        "createdAt": current_iso_time(),
    }
    put_json("projects", project_id, project)
    return ResearchProject(**project)


@app.patch("/projects/{project_id}", response_model=ResearchProject)
def patch_project(project_id: str, request: ResearchProjectPatchRequest) -> ResearchProject:
    project = require_project(project_id)
    update = request.model_dump(exclude_unset=True)
    for key, value in update.items():
        if value is not None:
            if isinstance(value, str):
                value = value.strip()
            if key == "title" and not value:
                raise HTTPException(status_code=400, detail="Project title is required")
            project[key] = value
    put_json("projects", project_id, project)
    return ResearchProject(**project)


@app.get("/lab-instances", response_model=list[LabInstance])
def lab_instances() -> list[LabInstance]:
    return [LabInstance(**lab) for lab in list_json("lab_instances")]


@app.patch("/lab-instances/{lab_id}", response_model=LabInstance)
def patch_lab_instance(lab_id: str, request: LabInstancePatchRequest) -> LabInstance:
    lab = get_json("lab_instances", lab_id)
    if lab is None:
        raise HTTPException(status_code=404, detail="Lab instance not found")

    update = request.model_dump(exclude_unset=True)
    if request.projectId is not None:
        require_project(request.projectId)
    for key, value in update.items():
        if value is not None:
            lab[key] = value

    put_json("lab_instances", lab_id, lab)
    return LabInstance(**lab)


@app.get("/cards", response_model=list[WorkflowCard])
def cards() -> list[WorkflowCard]:
    return [WorkflowCard(**card) for card in list_json("cards")]


@app.post("/cards", response_model=WorkflowCard)
def create_card(request: WorkflowCardCreateRequest) -> WorkflowCard:
    title = request.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Card title is required")

    lab_id = resolve_lab_id(request.projectId, request.labId)
    agent = ROOM_AGENT_MAP[request.currentRoom]
    card_id = f"task-{uuid4().hex[:12]}"
    card = {
        "id": card_id,
        "projectId": request.projectId,
        "labId": lab_id,
        "title": title,
        "type": request.type,
        "currentRoom": request.currentRoom,
        "status": "queued",
        "progress": STATUS_PROGRESS_MAP["queued"],
        "assignedAgent": agent,
        "lastAgent": agent,
        "lastUpdated": current_clock_time(),
        "requiresUserReview": False,
        "sourcePaperId": None,
        "evidenceCount": 0,
        "approvalStatus": "draft",
        "summary": request.summary.strip() or f"Manual task created for {request.currentRoom.replace('_', ' ')}.",
        "details": request.details or {"Created from": "Task Board"},
    }
    put_json("cards", card_id, card)
    create_card_log(card, "info", "Task created", f"Manual task added to {request.currentRoom}: {title}")
    return WorkflowCard(**card)


@app.patch("/cards/{card_id}", response_model=WorkflowCard)
def patch_card(card_id: str, request: WorkflowCardPatchRequest) -> WorkflowCard:
    card = get_json("cards", card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Workflow card not found")

    update = request.model_dump(exclude_unset=True)
    old_status = card["status"]
    old_room = card["currentRoom"]

    for key, value in update.items():
        if value is not None:
            card[key] = value

    if "currentRoom" in update and "assignedAgent" not in update:
        card["assignedAgent"] = ROOM_AGENT_MAP[card["currentRoom"]]
    if "status" in update:
        card["progress"] = update.get("progress", STATUS_PROGRESS_MAP.get(card["status"], card.get("progress", 0)))
        card["approvalStatus"] = update.get("approvalStatus", STATUS_APPROVAL_MAP.get(card["status"], card.get("approvalStatus", "draft")))
        card["requiresUserReview"] = update.get(
            "requiresUserReview",
            card["status"] in {"waiting_for_user", "waiting_for_leader_review", "needs_more_evidence"},
        )
    card["lastAgent"] = update.get("lastAgent", card.get("assignedAgent", "coordinator"))
    card["lastUpdated"] = current_clock_time()

    put_json("cards", card_id, card)
    if card["status"] != old_status or card["currentRoom"] != old_room:
        create_card_log(
            card,
            "info",
            "Task moved",
            f"{card['title']} moved from {old_room}/{old_status} to {card['currentRoom']}/{card['status']}.",
        )
    return WorkflowCard(**card)


@app.delete("/cards/{card_id}")
def delete_card(card_id: str) -> dict[str, bool | str]:
    card = get_json("cards", card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Workflow card not found")
    deleted = delete_json("cards", card_id)
    create_card_log(card, "warning", "Task deleted", f"Task removed from board: {card['title']}")
    return {"ok": deleted, "id": card_id}


@app.get("/agent-logs", response_model=list[AgentLogEntry])
def agent_logs() -> list[AgentLogEntry]:
    logs = [AgentLogEntry(**log) for log in list_json("agent_logs")]
    return list(reversed(logs))


@app.get("/agent-runs", response_model=list[AgentRunRecord])
def agent_runs() -> list[AgentRunRecord]:
    return [AgentRunRecord(**entry) for entry in reversed(list_json("agent_runs"))]


@app.get("/research-runs", response_model=list[ResearchRunRecord])
def research_runs() -> list[ResearchRunRecord]:
    return [ResearchRunRecord(**entry) for entry in reversed(list_json("research_runs"))]


@app.get("/agent-messages", response_model=list[AgentMessageRecord])
def agent_messages() -> list[AgentMessageRecord]:
    return [AgentMessageRecord(**entry) for entry in reversed(list_json("agent_messages"))]


@app.get("/model-runtime", response_model=ModelRuntimeStatus)
def model_runtime() -> ModelRuntimeStatus:
    return ModelRuntimeStatus(**OllamaClient(timeout_seconds=3).status())


@app.get("/leader-decisions", response_model=list[LeaderDecisionRecord])
def leader_decisions() -> list[LeaderDecisionRecord]:
    decisions = [LeaderDecisionRecord(**decision) for decision in list_json("leader_decisions")]
    return list(reversed(decisions))


@app.get("/library", response_model=list[LibraryEntry])
def library() -> list[LibraryEntry]:
    entries = [LibraryEntry(**entry) for entry in list_json("library_entries")]
    return list(reversed(entries))


@app.get("/claims", response_model=list[ResearchClaim])
def claims() -> list[ResearchClaim]:
    entries = [ResearchClaim(**entry) for entry in list_json("claims")]
    return list(reversed(entries))


@app.get("/evidence", response_model=list[EvidenceRecord])
def evidence() -> list[EvidenceRecord]:
    entries = [EvidenceRecord(**entry) for entry in list_json("evidence_items")]
    return list(reversed(entries))


@app.get("/debate-sessions", response_model=list[DebateSessionRecord])
def debate_sessions() -> list[DebateSessionRecord]:
    entries = [DebateSessionRecord(**entry) for entry in list_json("debate_sessions")]
    return list(reversed(entries))


@app.get("/hypotheses", response_model=list[HypothesisRecord])
def hypotheses() -> list[HypothesisRecord]:
    entries = [HypothesisRecord(**entry) for entry in list_json("hypotheses")]
    return list(reversed(entries))


@app.get("/experiment-plans", response_model=list[ExperimentPlanRecord])
def experiment_plans() -> list[ExperimentPlanRecord]:
    entries = [ExperimentPlanRecord(**entry) for entry in list_json("experiment_plans")]
    return list(reversed(entries))


@app.post("/agent-actions", response_model=AgentActionResult)
def create_agent_action(request: AgentActionRequest) -> AgentActionResult:
    try:
        result = run_agent_action(request.cardId, request.action)
    except PipelineError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return AgentActionResult(**result)


def execute_background_research_run(run_id: str) -> None:
    record = get_json("research_runs", run_id)
    if record is None:
        return
    try:
        run_agent_action(record["sourceCardId"], record["action"], run_id=run_id)
    except PipelineError:
        # The durable ResearchRun record contains the failure and checkpoint.
        return


@app.post("/research-runs", response_model=ResearchRunRecord)
def enqueue_research_run(request: AgentActionRequest, background_tasks: BackgroundTasks) -> ResearchRunRecord:
    card = get_json("cards", request.cardId)
    if card is None:
        raise HTTPException(status_code=404, detail=f"Card {request.cardId} was not found")
    record = create_research_run(card, request.action)
    background_tasks.add_task(execute_background_research_run, record["id"])
    return ResearchRunRecord(**record)


@app.post("/research-runs/{run_id}/resume", response_model=AgentActionResult)
def resume_research_run(run_id: str) -> AgentActionResult:
    record = get_json("research_runs", run_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"ResearchRun {run_id} was not found")
    if record.get("status") == "completed":
        raise HTTPException(status_code=409, detail="Completed ResearchRun cannot be resumed")
    try:
        result = run_agent_action(record["sourceCardId"], record["action"], run_id=run_id)
    except PipelineError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return AgentActionResult(**result)


@app.post("/ingest/folder", response_model=IngestFolderRecord)
def register_ingest_folder(request: IngestFolderRequest) -> IngestFolderRecord:
    lab_id = resolve_lab_id(request.projectId, request.labId)
    folder = Path(request.path).expanduser().resolve(strict=False)
    record = {
        "id": f"ingest-{uuid4().hex[:12]}",
        "projectId": request.projectId,
        "labId": lab_id,
        "path": str(folder),
        "registeredAt": current_iso_time(),
        "exists": folder.is_dir(),
    }
    put_json("ingest_folders", record["id"], record)
    return IngestFolderRecord(**record)


@app.get("/ingest/folders", response_model=list[IngestFolderRecord])
def ingest_folders(projectId: str | None = None, labId: str | None = None) -> list[IngestFolderRecord]:
    records = list_json("ingest_folders")
    if projectId is not None:
        resolved_lab_id = resolve_lab_id(projectId, labId)
        records = [
            record
            for record in records
            if record.get("projectId") == projectId and record.get("labId") == resolved_lab_id
        ]
    elif labId is not None:
        lab = get_json("lab_instances", labId)
        if lab is None:
            raise HTTPException(status_code=400, detail=f"Lab {labId} was not found")
        records = [
            record
            for record in records
            if record.get("projectId") == lab.get("projectId") and record.get("labId") == labId
        ]
    return [IngestFolderRecord(**record) for record in reversed(records)]


@app.get("/ingest/folder", response_model=IngestFolderRecord | None)
def ingest_folder(projectId: str | None = None, labId: str | None = None) -> IngestFolderRecord | None:
    if projectId is None and labId is None:
        records = list_json("ingest_folders")
        record = records[-1] if records else get_json("ingest_folders", "active")
    else:
        resolved_project_id = projectId or "project-autophagy"
        resolved_lab_id = resolve_lab_id(resolved_project_id, labId)
        record = latest_ingest_record(resolved_project_id, resolved_lab_id)
        if record is None:
            record = get_json("ingest_folders", "active")
    if record is None:
        return None
    folder = Path(record["path"])
    record["exists"] = folder.is_dir()
    return IngestFolderRecord(**record)


@app.get("/papers", response_model=list[PaperFileRecord])
def papers() -> list[PaperFileRecord]:
    return [PaperFileRecord(**paper) for paper in list_json("paper_files")]


@app.get("/papers/{paper_id}", response_model=PaperFileRecord)
def paper(paper_id: str) -> PaperFileRecord:
    record = get_json("paper_files", paper_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Paper file not found")
    return PaperFileRecord(**record)


@app.get("/papers/{paper_id}/text", response_model=PaperTextRecord)
def paper_text(paper_id: str) -> PaperTextRecord:
    record = get_json("paper_texts", paper_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Parsed paper text not found")
    return PaperTextRecord(**record)


@app.get("/metadata/lookup", response_model=MetadataLookupResponse)
def metadata_lookup(doi: str, provider: str = "both") -> MetadataLookupResponse:
    normalized = normalize_doi(doi)
    if not normalized:
        raise HTTPException(status_code=400, detail="A DOI is required")
    try:
        candidates = lookup_metadata(normalized, provider)
    except MetadataAdapterError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return MetadataLookupResponse(
        doi=normalized,
        candidates=[MetadataCandidate(**candidate) for candidate in candidates],
    )


@app.post("/ingest/scan", response_model=IngestScanResult)
def scan_ingest_folder(projectId: str | None = None, labId: str | None = None) -> IngestScanResult:
    if projectId is None and labId is None:
        records = list_json("ingest_folders")
        record = records[-1] if records else get_json("ingest_folders", "active")
    else:
        resolved_project_id = projectId or "project-autophagy"
        resolved_lab_id = resolve_lab_id(resolved_project_id, labId)
        record = latest_ingest_record(resolved_project_id, resolved_lab_id)
        if record is None:
            record = get_json("ingest_folders", "active")
    if record is None:
        raise HTTPException(status_code=400, detail="No ingest folder is registered")

    folder = Path(record["path"])
    if not folder.is_dir():
        raise HTTPException(status_code=400, detail="Registered ingest folder does not exist")

    project_id = record.get("projectId", "project-autophagy")
    lab_id = record.get("labId")
    existing_papers = list_json("paper_files")
    paper_records, card_records, text_records = scan_pdf_folder(
        folder,
        project_id=project_id,
        lab_id=lab_id,
    )

    existing_by_scope = {
        (paper.get("sha256"), paper.get("projectId"), paper.get("labId")): paper
        for paper in existing_papers
        if paper.get("sha256")
    }
    existing_by_id = {paper["id"]: paper for paper in existing_papers}
    id_remap: dict[str, str] = {}
    new_paper_count = 0
    duplicate_paper_count = 0

    for paper_record in paper_records:
        generated_id = paper_record["id"]
        existing = existing_by_id.get(generated_id) or existing_by_scope.get(
            (
                paper_record.get("sha256"),
                paper_record.get("projectId"),
                paper_record.get("labId"),
            )
        )
        if existing is None:
            new_paper_count += 1
            target_id = generated_id
        else:
            duplicate_paper_count += 1
            target_id = existing["id"]
            paper_record = {**existing, **paper_record, "id": target_id}
        id_remap[generated_id] = target_id
        put_json("paper_files", target_id, paper_record)

    for text_record in text_records:
        target_id = id_remap.get(text_record["id"], text_record["id"])
        text_record["id"] = target_id
        text_record["paperFileId"] = target_id
        put_json("paper_texts", target_id, text_record)

    normalized_cards: list[dict] = []
    for card in card_records:
        generated_paper_id = card.get("sourcePaperId")
        target_paper_id = id_remap.get(generated_paper_id, generated_paper_id)
        target_card_id = f"card-{target_paper_id}"
        card["id"] = target_card_id
        card["sourcePaperId"] = target_paper_id
        existing_card = get_json("cards", target_card_id)
        if existing_card is not None:
            preserve_workflow = existing_card.get("status") not in {"queued", "failed"}
            card = {
                **card,
                **(existing_card if preserve_workflow else {}),
                "id": target_card_id,
                "sourcePaperId": target_paper_id,
                "title": card["title"],
                "summary": existing_card.get("summary") if preserve_workflow else card["summary"],
                "details": {
                    **existing_card.get("details", {}),
                    **card.get("details", {}),
                },
            }
        put_json("cards", target_card_id, card)
        normalized_cards.append(card)

    card_records = normalized_cards

    error_messages = [
        f"{paper['fileName']}: {paper['errorMessage']}"
        for paper in paper_records
        if paper.get("errorMessage")
    ]
    paper_card_count = sum(1 for card in card_records if card["type"] == "paper")
    error_card_count = sum(1 for card in card_records if card["type"] == "error")
    parsed_paper_count = sum(
        1 for paper_record in paper_records
        if paper_record.get("textExtractionStatus") == "parsed"
    )
    reader_queue_count = sum(
        1 for card in card_records
        if card.get("type") == "paper"
        and card.get("currentRoom") == "reading"
        and card.get("status") == "queued"
    )

    log_id = f"log-{uuid4().hex[:12]}"
    put_json(
        "agent_logs",
        log_id,
        {
            "id": log_id,
            "projectId": project_id,
            "labId": lab_id,
            "time": current_clock_time(),
            "agent": "collector",
            "room": "collection",
            "level": "warning" if error_messages else "info",
            "title": "PDF folder scanned",
            "message": (
                f"{len(paper_records)} PDFs scanned: {new_paper_count} new, "
                f"{duplicate_paper_count} existing, {parsed_paper_count} parsed, "
                f"{reader_queue_count} queued for Reader."
            ),
            "relatedCardId": card_records[0]["id"] if card_records else None,
        },
    )

    return IngestScanResult(
        folderPath=str(folder),
        pdfCount=len(paper_records),
        paperCardCount=paper_card_count,
        errorCardCount=error_card_count,
        newPaperCount=new_paper_count,
        duplicatePaperCount=duplicate_paper_count,
        parsedPaperCount=parsed_paper_count,
        readerQueueCount=reader_queue_count,
        parserAvailable=is_pymupdf_available(),
        errors=error_messages,
    )


@app.post("/leader-decisions", response_model=LeaderDecisionRecord)
def create_leader_decision(request: LeaderDecisionRequest) -> LeaderDecisionRecord:
    card = get_json("cards", request.cardId)
    if card is None:
        raise HTTPException(status_code=404, detail="Workflow card not found")
    if request.decision == "stored_in_library" and card_has_unverified_evidence(card):
        raise HTTPException(
            status_code=400,
            detail="Unverified evidence must be resolved before this card can be stored in Library",
        )

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
        "projectId": card.get("projectId", "project-autophagy"),
        "labId": card.get("labId"),
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
            "projectId": card.get("projectId", "project-autophagy"),
            "labId": card.get("labId"),
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
                "projectId": card.get("projectId", "project-autophagy"),
                "labId": card.get("labId"),
                "title": card["title"],
                "summary": card["summary"],
                "sourceCardId": card["id"],
                "decisionId": decision_id,
                "evidenceCount": card["evidenceCount"],
                "storedAt": created_at,
            },
        )

    return LeaderDecisionRecord(**record)
