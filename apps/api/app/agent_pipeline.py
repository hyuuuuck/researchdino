from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from uuid import uuid4

from .storage import get_json, put_json


class PipelineError(ValueError):
    pass


def current_clock_time() -> str:
    return datetime.now().strftime("%H:%M")


def card_project_id(card: dict[str, Any]) -> str:
    return str(card.get("projectId") or "project-autophagy")


def card_lab_id(card: dict[str, Any]) -> str | None:
    lab_id = card.get("labId")
    return str(lab_id) if lab_id else None


def run_agent_action(card_id: str, action: str) -> dict[str, Any]:
    if action == "run_research_pipeline":
        return run_research_pipeline(card_id)
    if action == "run_reader":
        return run_reader(card_id)
    if action == "run_debate":
        return run_debate(card_id)
    if action == "design_experiment":
        return design_experiment(card_id)
    if action == "draft_manuscript":
        return draft_manuscript(card_id)
    raise PipelineError(f"Unsupported agent action: {action}")


def run_research_pipeline(card_id: str) -> dict[str, Any]:
    """Advance a source paper or active debate to a Leader review packet.

    This intentionally stops before Library storage. ResearchDino's human/PI
    gate remains the only path that can promote a conclusion into Library.
    """
    source_card = require_card(card_id)
    updated_ids: list[str] = []
    created_ids: list[str] = []

    if source_card["type"] == "paper":
        reader_result = run_reader(card_id)
        updated_ids.extend(reader_result["updatedCardIds"])
        created_ids.extend(reader_result["createdCardIds"])
        debate_id = reader_result["createdCardIds"][0]
    elif source_card["type"] in {"claim_debate", "paper_review", "contradiction_review", "hypothesis_debate"}:
        debate_id = card_id
    else:
        raise PipelineError("Research pipeline starts from a paper or debate card.")

    debate_result = run_debate(debate_id)
    updated_ids.extend(debate_result["updatedCardIds"])
    created_ids.extend(debate_result["createdCardIds"])

    debate_card = require_card(debate_id)
    write_log(
        agent="coordinator",
        room="coordinator",
        level="approval",
        title="Research pipeline reached Leader review",
        message="Reader extraction, structured debate, strategy handoff, and experiment handoff are complete. Library storage still requires Leader approval.",
        related_card_id=debate_id,
        project_id=card_project_id(debate_card),
        lab_id=card_lab_id(debate_card),
    )

    return {
        "action": "run_research_pipeline",
        "sourceCardId": card_id,
        "updatedCardIds": unique_ids(updated_ids),
        "createdCardIds": unique_ids(created_ids),
        "message": "Research pipeline advanced to Leader review. Approve from Reports to store it in Library.",
    }


def run_reader(card_id: str) -> dict[str, Any]:
    card = require_card(card_id)
    if card["type"] not in {"paper", "error"}:
        raise PipelineError("Reader can only run on paper cards.")
    if card["type"] == "error":
        raise PipelineError("Reader cannot run on a failed scan card.")

    paper_id = card.get("sourcePaperId") or card["id"]
    text_record = get_json("paper_texts", paper_id)
    text = str(text_record.get("text", "")) if text_record else ""
    parsed = bool(text.strip())
    claim_text = infer_claim_text(card, text)
    evidence_items = infer_evidence_items(card, text)
    limitations = infer_limitations(text)

    card["currentRoom"] = "reading"
    card["status"] = "running"
    card["progress"] = 82 if parsed else 58
    card["assignedAgent"] = "reader"
    card["lastAgent"] = "reader"
    card["lastUpdated"] = current_clock_time()
    card["evidenceCount"] = max(card.get("evidenceCount", 0), len(evidence_items))
    card["summary"] = (
        "Reader extracted claims and evidence from parsed text."
        if parsed
        else "Reader created a metadata-only extraction; full text parsing is still pending."
    )
    card.setdefault("details", {})
    card["details"].update(
        {
            "Reader status": "parsed_text" if parsed else "metadata_only",
            "Claim candidates": [claim_text],
            "Evidence candidates": evidence_items,
            "Limitations": limitations,
            "Next room": "Debate Room",
        }
    )
    put_json("cards", card["id"], card)

    debate_card = build_debate_card(card, claim_text, evidence_items, limitations)
    put_json("cards", debate_card["id"], debate_card)

    write_log(
        agent="reader",
        room="reading",
        level="info",
        title="Reader extraction completed",
        message=f"{card['title']} produced 1 claim candidate and {len(evidence_items)} evidence items.",
        related_card_id=card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )
    write_log(
        agent="critic",
        room="debate",
        level="debate",
        title="Claim queued for debate",
        message="Critic, Strategist, and Experiment deputies can now challenge the extracted claim.",
        related_card_id=debate_card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )

    return {
        "action": "run_reader",
        "sourceCardId": card["id"],
        "updatedCardIds": [card["id"]],
        "createdCardIds": [debate_card["id"]],
        "message": "Reader extraction created a Debate Room claim card.",
    }


def run_debate(card_id: str) -> dict[str, Any]:
    card = require_card(card_id)
    if card["type"] not in {"claim_debate", "paper_review", "contradiction_review", "hypothesis_debate"}:
        raise PipelineError("Debate can only run on debate/review cards.")

    claim_text = detail_text(card, "claim_text", card["title"])
    evidence_items = detail_list(card, "evidence_items") or detail_list(card, "supporting_evidence")
    supporting_evidence = detail_list(card, "supporting_evidence") or evidence_items[:2]
    opposing_evidence = detail_list(card, "opposing_evidence") or [
        "Control details require confirmation before Library storage.",
        "Replication context is not yet strong enough for final reuse.",
    ]
    unresolved = detail_list(card, "unresolved_questions") or [
        "Does the claim reproduce across independent conditions?",
        "Which control is required before final approval?",
    ]
    suggested_experiments = detail_list(card, "suggested_experiments") or [
        "Time-course validation with vehicle and unstressed controls",
        "Replicate readout with an orthogonal marker",
    ]
    hypotheses = detail_list(card, "strategist_hypotheses") or [
        "The observed effect may depend on a delayed adaptive response window.",
    ]
    debate_protocol = build_debate_protocol(claim_text)
    agent_positions = build_agent_positions(
        claim_text,
        supporting_evidence,
        opposing_evidence,
        hypotheses,
        suggested_experiments,
    )
    cross_examination = [
        f"Critic challenges Reader evidence: {opposing_evidence[0]}",
        f"Reader must trace the claim back to source spans: {supporting_evidence[0]}",
        f"Strategist reframes the conflict as a testable gap: {hypotheses[0]}",
    ]
    hypothesis_tests = [
        f"Stress-test hypothesis against opposing evidence: {opposing_evidence[0]}",
        "Keep the claim provisional unless control, replicate, and source-trace criteria are satisfied.",
        f"Pass the strongest falsifiable test to Experiment Bay: {suggested_experiments[0]}",
    ]
    conclusion = (
        "The claim is promising but not final. It can move forward only as a provisional research hypothesis "
        "with explicit controls, replication criteria, and source traceability."
    )
    research_strategy_outputs = [
        "Search adjacent literature for contradiction, replication, and missing-control papers.",
        "Rank the gap by novelty, feasibility, evidence strength, and manuscript relevance.",
        "Keep unsupported claims out of the Library until Leader approval.",
    ]
    experiment_strategy_outputs = [
        suggested_experiments[0],
        "Define positive, vehicle, and unstressed controls before running the protocol.",
        "Require an orthogonal readout before treating the claim as reusable evidence.",
    ]
    decision_criteria = [
        "Approve only if supporting evidence survives Critic objections.",
        "Request more evidence if source spans, controls, or replicate counts are incomplete.",
        "Reject or archive if the hypothesis cannot be made experimentally testable.",
    ]

    card["currentRoom"] = "leader"
    card["status"] = "waiting_for_leader_review"
    card["progress"] = 88
    card["assignedAgent"] = "leader"
    card["lastAgent"] = "coordinator"
    card["lastUpdated"] = current_clock_time()
    card["requiresUserReview"] = True
    card["approvalStatus"] = "pending_review"
    card["evidenceCount"] = max(card.get("evidenceCount", 0), len(supporting_evidence) + len(opposing_evidence))
    card["summary"] = "Debate completed. Coordinator prepared a Leader review packet."
    card.setdefault("details", {})
    card["details"].update(
        {
            "supporting_evidence": supporting_evidence,
            "opposing_evidence": opposing_evidence,
            "critic_comments": detail_list(card, "critic_comments")
            or ["Evidence is promising, but controls and replication remain provisional."],
            "unresolved_questions": unresolved,
            "suggested_experiments": suggested_experiments,
            "strategist_hypotheses": hypotheses,
            "debate_protocol": debate_protocol,
            "agent_positions": agent_positions,
            "cross_examination": cross_examination,
            "hypothesis_tests": hypothesis_tests,
            "debate_conclusion": conclusion,
            "research_strategy_outputs": research_strategy_outputs,
            "experiment_strategy_outputs": experiment_strategy_outputs,
            "decision_criteria": decision_criteria,
            "leader_decision_status": "waiting_for_leader_review",
            "meeting_summary": "Reader evidence, Critic objections, Strategy hypotheses, Experiment feasibility, and Librarian source checks were merged into one Leader packet.",
            "library_save_status": "blocked_until_leader_approval",
        }
    )
    put_json("cards", card["id"], card)

    hypothesis_card = build_hypothesis_card(card, claim_text, hypotheses, unresolved)
    experiment_card = build_experiment_card(card, suggested_experiments)
    put_json("cards", hypothesis_card["id"], hypothesis_card)
    put_json("cards", experiment_card["id"], experiment_card)

    write_log(
        agent="critic",
        room="debate",
        level="debate",
        title="Debate objections consolidated",
        message="Critic marked unresolved controls and replication requirements.",
        related_card_id=card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )
    write_log(
        agent="reader",
        room="debate",
        level="debate",
        title="Reader defended source evidence",
        message=supporting_evidence[0],
        related_card_id=card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )
    write_log(
        agent="strategist",
        room="strategy",
        level="info",
        title="Hypothesis card generated",
        message="Strategist converted debate gaps into a hypothesis candidate.",
        related_card_id=hypothesis_card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )
    write_log(
        agent="experiment",
        room="experiment",
        level="info",
        title="Experiment plan queued",
        message="Experiment deputy drafted an initial feasibility plan from debate outputs.",
        related_card_id=experiment_card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )
    write_log(
        agent="librarian",
        room="library",
        level="warning",
        title="Library gate remains closed",
        message="Librarian will store only Leader-approved claims with source traces and resolved objections.",
        related_card_id=card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )
    write_log(
        agent="coordinator",
        room="coordinator",
        level="approval",
        title="Leader packet prepared",
        message="Coordinator sent the debate packet to Leader Office for approval.",
        related_card_id=card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )

    return {
        "action": "run_debate",
        "sourceCardId": card["id"],
        "updatedCardIds": [card["id"]],
        "createdCardIds": [hypothesis_card["id"], experiment_card["id"]],
        "message": "Debate outputs were routed to Leader, Strategy, and Experiment rooms.",
    }


def design_experiment(card_id: str) -> dict[str, Any]:
    card = require_card(card_id)
    if card["type"] not in {"hypothesis", "experiment_feasibility"}:
        raise PipelineError("Experiment design can only run on hypothesis or feasibility cards.")

    statement = detail_text(card, "Hypothesis", card["title"])
    experiment_card = build_experiment_card(
        card,
        [
            "Define independent variable and vehicle control",
            "Run time-course readout with biological replicates",
            "Add failure criteria for saturation or toxicity",
        ],
        title=f"Experiment Plan: {statement[:48]}",
    )
    experiment_card["status"] = "running"
    experiment_card["progress"] = 46
    put_json("cards", experiment_card["id"], experiment_card)

    card["lastAgent"] = "experiment"
    card["lastUpdated"] = current_clock_time()
    card["progress"] = max(card.get("progress", 0), 58)
    card.setdefault("details", {})
    card["details"]["Experiment plan"] = experiment_card["id"]
    put_json("cards", card["id"], card)

    write_log(
        agent="experiment",
        room="experiment",
        level="info",
        title="Experiment design drafted",
        message="Experiment Bay created a protocol skeleton from the selected hypothesis.",
        related_card_id=experiment_card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )

    return {
        "action": "design_experiment",
        "sourceCardId": card["id"],
        "updatedCardIds": [card["id"]],
        "createdCardIds": [experiment_card["id"]],
        "message": "Experiment Bay drafted a protocol skeleton.",
    }


def draft_manuscript(card_id: str) -> dict[str, Any]:
    card = require_card(card_id)
    manuscript_id = f"manuscript-{card['id']}"
    manuscript_card = {
        "id": manuscript_id,
        "projectId": card_project_id(card),
        "labId": card_lab_id(card),
        "title": f"Manuscript Outline: {card['title'][:54]}",
        "type": "manuscript",
        "currentRoom": "writing",
        "status": "queued",
        "progress": 30,
        "assignedAgent": "writer",
        "lastAgent": "writer",
        "lastUpdated": current_clock_time(),
        "requiresUserReview": True,
        "sourcePaperId": card.get("sourcePaperId"),
        "evidenceCount": card.get("evidenceCount", 0),
        "approvalStatus": "needs_revision",
        "summary": "Writer drafted an evidence-aware manuscript outline from the selected card.",
        "details": {
            "Source card": card["id"],
            "Outline sections": ["Abstract", "Introduction", "Evidence synthesis", "Limitations"],
            "Citation status": "citation_required",
        },
    }
    put_json("cards", manuscript_card["id"], manuscript_card)
    write_log(
        agent="writer",
        room="writing",
        level="info",
        title="Manuscript outline queued",
        message="Writer created an outline that still requires citation review.",
        related_card_id=manuscript_card["id"],
        project_id=card_project_id(card),
        lab_id=card_lab_id(card),
    )
    return {
        "action": "draft_manuscript",
        "sourceCardId": card["id"],
        "updatedCardIds": [],
        "createdCardIds": [manuscript_card["id"]],
        "message": "Writing Studio queued a manuscript outline.",
    }


def build_debate_card(
    paper_card: dict[str, Any],
    claim_text: str,
    evidence_items: list[str],
    limitations: list[str],
) -> dict[str, Any]:
    paper_id = paper_card.get("sourcePaperId") or paper_card["id"]
    debate_id = f"debate-{paper_id}"
    return {
        "id": debate_id,
        "projectId": card_project_id(paper_card),
        "labId": card_lab_id(paper_card),
        "title": f"Claim Debate: {claim_text[:52]}",
        "type": "claim_debate",
        "currentRoom": "debate",
        "status": "debating",
        "progress": 42,
        "assignedAgent": "critic",
        "lastAgent": "reader",
        "lastUpdated": current_clock_time(),
        "requiresUserReview": False,
        "sourcePaperId": paper_id,
        "evidenceCount": len(evidence_items),
        "approvalStatus": "draft",
        "summary": "Reader output is ready for Critic, Strategist, and Experiment debate.",
        "details": {
            "debate_session_id": f"DB-{paper_id[-8:]}",
            "source_paper": paper_card["title"],
            "target_claim": f"claim-{paper_id[-6:]}",
            "claim_text": claim_text,
            "evidence_items": evidence_items,
            "supporting_evidence": evidence_items[:2] or ["Metadata indicates the paper is ready for deeper reading."],
            "opposing_evidence": limitations or ["Full limitation extraction is pending."],
            "critic_comments": ["Controls, sample size, and replication must be checked before approval."],
            "unresolved_questions": ["What evidence is strong enough for Library reuse?"],
            "suggested_follow_up_papers": ["Search Dock should expand citation and related-work leads."],
            "suggested_experiments": ["Experiment Bay should draft a feasibility check after debate."],
            "strategist_hypotheses": ["Strategy Room should convert the claim into a testable hypothesis."],
            "debate_protocol": build_debate_protocol(claim_text),
            "agent_positions": build_agent_positions(
                claim_text,
                evidence_items[:2] or ["Metadata indicates the paper is ready for deeper reading."],
                limitations or ["Full limitation extraction is pending."],
                ["Strategy Room should convert the claim into a testable hypothesis."],
                ["Experiment Bay should draft a feasibility check after debate."],
            ),
            "cross_examination": [
                "Critic challenges whether the claim survives controls, sample size, and replication checks.",
                "Reader must point every defended statement back to source spans.",
                "Strategist must convert unresolved conflict into a falsifiable gap.",
            ],
            "hypothesis_tests": [
                "Check whether the claim can be falsified by a missing-control result.",
                "Check whether independent evidence supports or contradicts the same mechanism.",
                "Check whether the proposed experiment can separate technical artifact from biological effect.",
            ],
            "debate_conclusion": "Debate has started; no conclusion until evidence, objections, hypotheses, and feasibility checks are synthesized.",
            "research_strategy_outputs": ["Expand citation search around contradictions and missing controls."],
            "experiment_strategy_outputs": ["Draft an initial feasibility test only after Critic objections are listed."],
            "decision_criteria": ["Leader approval requires traceable evidence and resolved objections."],
            "leader_decision_status": "not_ready",
            "meeting_summary": "Debate has started from Reader extraction.",
            "library_save_status": "not_ready",
            "participating_agents": ["Reader", "Critic", "Strategist", "Experiment", "Librarian", "Leader"],
            "unresolved_issue_count": 1,
        },
    }


def build_hypothesis_card(
    debate_card: dict[str, Any],
    claim_text: str,
    hypotheses: list[str],
    unresolved: list[str],
) -> dict[str, Any]:
    hypothesis_id = f"hypothesis-{debate_card['id']}"
    return {
        "id": hypothesis_id,
        "projectId": card_project_id(debate_card),
        "labId": card_lab_id(debate_card),
        "title": f"Hypothesis: {hypotheses[0][:58]}",
        "type": "hypothesis",
        "currentRoom": "strategy",
        "status": "queued",
        "progress": 48,
        "assignedAgent": "strategist",
        "lastAgent": "strategist",
        "lastUpdated": current_clock_time(),
        "requiresUserReview": False,
        "sourcePaperId": debate_card.get("sourcePaperId"),
        "evidenceCount": debate_card.get("evidenceCount", 0),
        "approvalStatus": "draft",
        "summary": "Strategy Room generated a testable hypothesis from debate outputs.",
        "details": {
            "Claim source": claim_text,
            "Hypothesis": hypotheses[0],
            "Open questions": unresolved,
            "Debate conclusion": detail_text(debate_card, "debate_conclusion", "Conclusion pending Leader packet."),
            "Validation plan": detail_list(debate_card, "hypothesis_tests"),
            "Research strategy": detail_list(debate_card, "research_strategy_outputs"),
            "Experiment handoff": detail_list(debate_card, "experiment_strategy_outputs"),
            "Novelty": 64,
            "Feasibility": 58,
            "Impact": 66,
        },
    }


def build_experiment_card(
    source_card: dict[str, Any],
    suggested_experiments: list[str],
    title: str | None = None,
) -> dict[str, Any]:
    experiment_id = f"experiment-{source_card['id']}"
    return {
        "id": experiment_id,
        "projectId": card_project_id(source_card),
        "labId": card_lab_id(source_card),
        "title": title or f"Experiment Plan: {suggested_experiments[0][:54]}",
        "type": "experiment",
        "currentRoom": "experiment",
        "status": "queued",
        "progress": 34,
        "assignedAgent": "experiment",
        "lastAgent": "experiment",
        "lastUpdated": current_clock_time(),
        "requiresUserReview": False,
        "sourcePaperId": source_card.get("sourcePaperId"),
        "evidenceCount": source_card.get("evidenceCount", 0),
        "approvalStatus": "draft",
        "summary": "Experiment Bay drafted an initial protocol plan from strategy/debate outputs.",
        "details": {
            "Strategy source": source_card["id"],
            "Protocol outline": suggested_experiments,
            "Debate inputs": detail_list(source_card, "cross_examination"),
            "Hypothesis tests": detail_list(source_card, "hypothesis_tests"),
            "Decision criteria": detail_list(source_card, "decision_criteria"),
            "Control": "Vehicle and unstressed control",
            "Readout": "Reporter signal plus orthogonal marker",
            "Replicates": "Needs user/lab confirmation",
            "Failure point": "Signal saturation, toxicity, or missing replicate consistency",
        },
    }


def infer_claim_text(card: dict[str, Any], text: str) -> str:
    for sentence in split_sentences(text):
        if 60 <= len(sentence) <= 240:
            return sentence
    title = detail_text(card, "Title", card["title"])
    return f"{title} contains a claim that requires evidence-backed debate before Library reuse."


def infer_evidence_items(card: dict[str, Any], text: str) -> list[str]:
    sentences = split_sentences(text)
    items = [sentence for sentence in sentences[:3] if len(sentence) > 40]
    if items:
        return items[:3]
    title = detail_text(card, "Title", card["title"])
    return [
        f"Metadata record for {title}",
        "Local PDF scan record and SHA-256 trace",
    ]


def infer_limitations(text: str) -> list[str]:
    lowered = text.lower()
    if "limitation" in lowered:
        return ["Reader found an explicit limitation section or limitation language."]
    if text.strip():
        return ["Reader did not find enough structured limitation text in the first pass."]
    return ["Full-text extraction is not available yet; evidence remains metadata-only."]


def build_debate_protocol(claim_text: str) -> list[str]:
    return [
        f"Reader presents the claim with source traces: {claim_text}",
        "Critic attacks evidence strength, controls, statistics, and possible contradictions.",
        "Strategist turns unresolved conflict into competing hypotheses and research gaps.",
        "Experiment deputy tests whether each hypothesis can be falsified with realistic controls.",
        "Librarian checks whether any conclusion is safe to store as reusable knowledge.",
        "Coordinator synthesizes the strongest conclusion and sends a Leader decision packet.",
    ]


def build_agent_positions(
    claim_text: str,
    supporting_evidence: list[str],
    opposing_evidence: list[str],
    hypotheses: list[str],
    suggested_experiments: list[str],
) -> list[str]:
    return [
        f"Reader: defend only source-backed parts of the claim - {claim_text}",
        f"Critic: pressure-test the weakest point - {opposing_evidence[0] if opposing_evidence else 'missing controls'}",
        f"Strategist: propose the most useful research gap - {hypotheses[0] if hypotheses else 'hypothesis pending'}",
        f"Experiment: verify feasibility through controls - {suggested_experiments[0] if suggested_experiments else 'protocol pending'}",
        f"Librarian: preserve traceable evidence only - {supporting_evidence[0] if supporting_evidence else 'source trace pending'}",
        "Leader: approve, reject, or request more evidence after the coordinator synthesis.",
    ]


def split_sentences(text: str) -> list[str]:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return []
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", compact) if part.strip()]


def detail_text(card: dict[str, Any], key: str, fallback: str) -> str:
    value = card.get("details", {}).get(key)
    if isinstance(value, list):
        return ", ".join(str(item) for item in value)
    if value is None:
        return fallback
    return str(value)


def detail_list(card: dict[str, Any], key: str) -> list[str]:
    value = card.get("details", {}).get(key)
    if isinstance(value, list):
        return [str(item) for item in value]
    if value is None:
        return []
    return [str(value)]


def require_card(card_id: str) -> dict[str, Any]:
    card = get_json("cards", card_id)
    if card is None:
        raise PipelineError("Workflow card not found.")
    return card


def write_log(
    agent: str,
    room: str,
    level: str,
    title: str,
    message: str,
    related_card_id: str | None = None,
    project_id: str = "project-autophagy",
    lab_id: str | None = None,
) -> None:
    log_id = f"log-{uuid4().hex[:12]}"
    put_json(
        "agent_logs",
        log_id,
        {
            "id": log_id,
            "projectId": project_id,
            "labId": lab_id,
            "time": current_clock_time(),
            "agent": agent,
            "room": room,
            "level": level,
            "title": title,
            "message": message,
            "relatedCardId": related_card_id,
        },
    )


def unique_ids(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))
